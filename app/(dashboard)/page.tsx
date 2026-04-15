import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SyncButton } from "./SyncButton";
import { ChatPanel } from "./ChatPanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const since24h = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // last 7 days
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [digest, githubEvents, calendarEvents, tasks] = await Promise.all([
    prisma.digest.findFirst({
      where: { userId, coverDate: { gte: startOfDay } },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.gitHubEvent.findMany({
      where: { userId, eventAt: { gte: since24h } },
      orderBy: { eventAt: "desc" },
      take: 20,
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: startOfDay, lte: endOfDay } },
      orderBy: { startTime: "asc" },
    }),
    prisma.task.findMany({
      where: { userId, completed: false, OR: [{ dueDate: { lte: endOfDay } }, { dueDate: null }] },
      orderBy: [{ dueDate: "asc" }],
      take: 20,
    }),
  ]);

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{greeting}, {session.user.name?.split(" ")[0]}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="/settings" className="text-gray-400 hover:text-white transition-colors">Settings</a>
            <a href="/history" className="text-gray-400 hover:text-white transition-colors">History</a>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button type="submit" className="text-gray-400 hover:text-white transition-colors">Sign out</button>
            </form>
          </div>
        </header>

        {/* Digest */}
        <section className="bg-gray-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Daily Digest</h2>
            <SyncButton />
          </div>
          {digest ? (
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{digest.summaryText}</p>
          ) : (
            <p className="text-gray-500 text-sm">
              No digest yet for today. Click &ldquo;Sync now&rdquo; to fetch your data and generate your AI standup summary.
            </p>
          )}
        </section>

        <ChatPanel />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* GitHub */}
          <section className="bg-gray-900 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GitHub — Last 7 days</h2>
            {githubEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No activity yet. Sync to fetch.</p>
            ) : (
              <ul className="space-y-2">
                {githubEvents.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 font-medium ${
                      e.type === "commit" ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"
                    }`}>
                      {e.type === "commit" ? "commit" : "PR"}
                    </span>
                    <span className="text-gray-300 line-clamp-1">{e.title}</span>
                    <p className="text-gray-600 text-xs mt-0.5 ml-0">{e.repo}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Calendar */}
          <section className="bg-gray-900 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today&apos;s Calendar</h2>
            {calendarEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {session.user ? "No events today, or connect Google Calendar in Settings." : "Connect Google Calendar in Settings."}
              </p>
            ) : (
              <ul className="space-y-2">
                {calendarEvents.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-gray-300 font-medium line-clamp-1">{e.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(e.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {" – "}
                      {new Date(e.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {e.attendeeCount > 0 && ` · ${e.attendeeCount} attendees`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tasks */}
          <section className="bg-gray-900 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasks Due Today</h2>
            {tasks.length === 0 ? (
              <p className="text-gray-500 text-sm">No tasks due, or connect Todoist in Settings.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < now;
                  return (
                    <li key={t.id} className="text-sm flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        t.priority === "urgent" ? "bg-red-400" :
                        t.priority === "high" ? "bg-orange-400" : "bg-gray-600"
                      }`} />
                      <div>
                        <p className={`line-clamp-1 ${isOverdue ? "text-red-400" : "text-gray-300"}`}>{t.title}</p>
                        {t.project && <p className="text-gray-600 text-xs">{t.project}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
