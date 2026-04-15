import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const account = await prisma.account.findFirst({
    where: { provider: "github" },
    select: { access_token: true, scope: true },
  });

  console.log("Stored scope:", account?.scope);
  console.log("Has token:", !!account?.access_token);

  if (account?.access_token) {
    // Check what scopes GitHub actually sees for this token
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    const scopes = res.headers.get("x-oauth-scopes");
    console.log("GitHub token scopes:", scopes);

    // Fetch raw events to see what comes back
    const eventsRes = await fetch("https://api.github.com/users/ethanjhanks99/events?per_page=10", {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    const events = await eventsRes.json() as { type: string; created_at: string; repo: { name: string } }[];
    console.log(`\nRaw events from GitHub API (${events.length} total):`);
    for (const e of events.slice(0, 10)) {
      console.log(` - ${e.created_at}  ${e.type}  ${e.repo.name}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
