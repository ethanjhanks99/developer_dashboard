import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: { userId: session.user.id },
    select: { provider: true, needsReauth: true },
  });

  const isConnected = (provider: string): boolean =>
    connectedAccounts.some((a) => a.provider === provider && !a.needsReauth);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <a href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Dashboard
          </a>
          <h1 className="text-2xl font-bold">Settings</h1>
        </header>

        <section className="bg-gray-900 rounded-xl p-6 space-y-6">
          <h2 className="font-semibold text-lg">Connected Services</h2>

          <div className="space-y-4">
            <ServiceRow
              name="GitHub"
              description="Sign-in provider — connected via NextAuth"
              connected
              readOnly
            />
            <ServiceRow
              name="Google Calendar"
              description="Fetch today's events for your digest"
              connected={isConnected("google")}
              connectHref="/api/oauth/google"
            />
            <ServiceRow
              name="Todoist"
              description="Fetch tasks due today and overdue items"
              connected={isConnected("todoist")}
              connectHref="/api/oauth/todoist"
            />
          </div>
        </section>

        <section className="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Account</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "Avatar"}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{session.user.name}</p>
                <p className="text-sm text-gray-400">{session.user.email}</p>
              </div>
            </div>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button type="submit" className="text-sm text-red-400 hover:text-red-300 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function ServiceRow({
  name,
  description,
  connected,
  readOnly,
  connectHref,
}: {
  name: string;
  description: string;
  connected: boolean;
  readOnly?: boolean;
  connectHref?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <div>
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      {readOnly ? (
        <span className="text-xs px-2 py-1 rounded-full bg-green-900/40 text-green-400 font-medium">
          Connected
        </span>
      ) : connected ? (
        <span className="text-xs px-2 py-1 rounded-full bg-green-900/40 text-green-400 font-medium">
          Connected
        </span>
      ) : (
        <a
          href={connectHref}
          className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 transition-colors font-medium"
        >
          Connect
        </a>
      )}
    </div>
  );
}
