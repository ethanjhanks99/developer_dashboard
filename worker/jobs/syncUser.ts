import { Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { digestQueue } from "@/lib/queue";
import { fetchGitHubEvents } from "@/lib/github";
import { fetchCalendarEvents, refreshGoogleToken } from "@/lib/calendar";
import { fetchTodoistTasks } from "@/lib/todoist";

export async function syncUser(job: Job<{ userId: string }>): Promise<void> {
  const { userId } = job.data;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      connectedAccounts: true,
      // NextAuth v5 stores the GitHub token in the Account table, not User.githubAccessToken
      accounts: { where: { provider: "github" }, select: { access_token: true } },
    },
  });

  const errors: string[] = [];

  // --- GitHub ---
  // Token lives in the NextAuth Account table, not user.githubAccessToken
  const githubToken = user.accounts[0]?.access_token ?? null;
  let githubEvents: Awaited<ReturnType<typeof fetchGitHubEvents>> = [];
  try {
    if (githubToken && user.githubLogin) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
      githubEvents = await fetchGitHubEvents(githubToken, user.githubLogin, since);
      console.info({ userId, jobId: job.id, msg: `Fetched ${githubEvents.length} GitHub events` });
    } else {
      console.warn({ userId, jobId: job.id, msg: "No GitHub token or login — skipping GitHub sync" });
    }
  } catch (err) {
    errors.push(`GitHub: ${String(err)}`);
    console.error({ userId, jobId: job.id, source: "github", err });
  }

  // --- Google Calendar ---
  let calendarEvents: Awaited<ReturnType<typeof fetchCalendarEvents>> = [];
  const googleAccount = user.connectedAccounts.find((a) => a.provider === "google");

  if (googleAccount) {
    try {
      let { accessToken } = googleAccount;

      if (
        googleAccount.expiresAt &&
        googleAccount.expiresAt.getTime() - Date.now() < 5 * 60 * 1000
      ) {
        if (!googleAccount.refreshToken) throw new Error("No refresh token");
        const refreshed = await refreshGoogleToken(googleAccount.refreshToken);
        await prisma.connectedAccount.update({
          where: { id: googleAccount.id },
          data: { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt },
        });
        accessToken = refreshed.accessToken;
      }

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      calendarEvents = await fetchCalendarEvents(accessToken, now, tomorrow);
      console.info({ userId, jobId: job.id, msg: `Fetched ${calendarEvents.length} calendar events` });
    } catch (err) {
      errors.push(`Calendar: ${String(err)}`);
      console.error({ userId, jobId: job.id, source: "calendar", err });
      await prisma.connectedAccount.update({
        where: { id: googleAccount.id },
        data: { needsReauth: true },
      });
    }
  }

  // --- Todoist ---
  let tasks: Awaited<ReturnType<typeof fetchTodoistTasks>> = [];
  const todoistAccount = user.connectedAccounts.find((a) => a.provider === "todoist");

  if (todoistAccount) {
    try {
      tasks = await fetchTodoistTasks(todoistAccount.accessToken);
      console.info({ userId, jobId: job.id, msg: `Fetched ${tasks.length} tasks` });
    } catch (err) {
      errors.push(`Todoist: ${String(err)}`);
      console.error({ userId, jobId: job.id, source: "todoist", err });
    }
  }

  // --- Write to DB ---
  // GitHub events: use sha as a stable unique key (fallback to repo+time composite)
  // We create individually (not upsert on id) since id is a generated cuid
  for (const e of githubEvents) {
    const stableKey = e.sha ?? `${e.repo}-${e.eventAt.toISOString()}`;
    await prisma.gitHubEvent.upsert({
      where: { userId_stableKey: { userId, stableKey } },
      create: {
        userId,
        type: e.type,
        repo: e.repo,
        title: e.title,
        sha: e.sha,
        stableKey,
        eventAt: e.eventAt,
      },
      update: { syncedAt: new Date() },
    });
  }

  await prisma.$transaction([
    ...calendarEvents.map((e) =>
      prisma.calendarEvent.upsert({
        where: { userId_googleId: { userId, googleId: e.googleId } },
        create: {
          userId,
          googleId: e.googleId,
          title: e.title,
          description: e.description,
          startTime: e.startTime,
          endTime: e.endTime,
          attendeeCount: e.attendeeCount,
        },
        update: {
          title: e.title,
          description: e.description,
          startTime: e.startTime,
          endTime: e.endTime,
          attendeeCount: e.attendeeCount,
          syncedAt: new Date(),
        },
      })
    ),
    ...tasks.map((t) =>
      prisma.task.upsert({
        where: { userId_todoistId: { userId, todoistId: t.todoistId } },
        create: {
          userId,
          todoistId: t.todoistId,
          title: t.title,
          project: t.project,
          priority: t.priority,
          dueDate: t.dueDate,
          completed: t.completed,
        },
        update: {
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate,
          completed: t.completed,
          syncedAt: new Date(),
        },
      })
    ),
  ]);

  if (errors.length > 0) {
    console.warn({ userId, jobId: job.id, partialErrors: errors });
  }

  // Only enqueue digest if we actually have some data to summarize
  const hasData = githubEvents.length > 0 || calendarEvents.length > 0 || tasks.length > 0;
  if (hasData) {
    await digestQueue.add("generateDigest", { userId });
    console.info({ userId, jobId: job.id, msg: "Enqueued generateDigest" });
  } else {
    console.info({ userId, jobId: job.id, msg: "No data synced — skipping digest generation" });
  }
}
