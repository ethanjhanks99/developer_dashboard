import { Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { buildDigestContext } from "@/lib/context";
import { DIGEST_SYSTEM_PROMPT } from "@/lib/prompts";
import { env } from "@/lib/env";

export async function generateDigest(job: Job<{ userId: string }>): Promise<void> {
  const { userId } = job.data;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [githubEvents, calendarEvents, tasks] = await Promise.all([
    prisma.gitHubEvent.findMany({
      where: { userId, eventAt: { gte: since24h } },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: startOfDay } },
    }),
    prisma.task.findMany({
      where: { userId, completed: false },
    }),
  ]);

  const context = buildDigestContext({
    date: now,
    githubEvents: githubEvents.map((e) => ({
      repo: e.repo,
      type: e.type,
      title: e.title,
      eventAt: e.eventAt,
    })),
    calendarEvents: calendarEvents.map((e) => ({
      googleId: e.googleId,
      title: e.title,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      attendeeCount: e.attendeeCount,
    })),
    tasks: tasks.map((t) => ({
      todoistId: t.todoistId,
      title: t.title,
      project: t.project,
      priority: t.priority,
      dueDate: t.dueDate,
      completed: t.completed,
    })),
    now,
  });

  const coverDate = new Date(startOfDay);

  // DEV_SKIP_AI=true bypasses OpenAI to conserve tokens during development.
  // Remove this flag (or set it to false) when ready for a real test.
  const skipAI = process.env.DEV_SKIP_AI === "true";

  let summaryText: string;
  if (skipAI) {
    const eventCount = context.github.reduce((n, r) => n + r.events.length, 0);
    summaryText = [
      `[DEV MODE — AI skipped]`,
      `GitHub: ${eventCount} event(s) across ${context.github.length} repo(s)`,
      `Calendar: ${context.calendar.length} event(s) today`,
      `Tasks: ${context.tasks.length} open task(s)`,
    ].join("\n");
    console.info({ userId, jobId: job.id, msg: "Digest generated (DEV_SKIP_AI — no OpenAI call)" });
  } else {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: DIGEST_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(context) },
      ],
      stream: false,
    });
    summaryText = completion.choices[0]?.message?.content ?? "";
    console.info({ userId, jobId: job.id, msg: "Digest generated (OpenAI)" });
  }

  await prisma.digest.upsert({
    where: { userId_coverDate: { userId, coverDate } },
    create: { userId, summaryText, contextSnapshot: context, coverDate },
    update: { summaryText, contextSnapshot: context, generatedAt: new Date() },
  });
}
