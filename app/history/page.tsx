import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HistoryPage(): Promise<React.JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const digests = await prisma.digest.findMany({
    where: { userId: session.user.id },
    orderBy: { coverDate: "desc" },
    take: 30,
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <a href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Dashboard
          </a>
          <h1 className="text-2xl font-bold">Digest History</h1>
        </header>

        {digests.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">No digests yet. Go to the dashboard and click &ldquo;Sync now&rdquo; to generate your first one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {digests.map((digest) => (
              <article key={digest.id} className="bg-gray-900 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {new Date(digest.coverDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h2>
                  <span className="text-xs text-gray-500">
                    Generated {new Date(digest.generatedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {digest.summaryText}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
