import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({
    include: { accounts: { select: { provider: true, access_token: true } } },
  });
  console.log("User:", JSON.stringify({ id: user?.id, name: user?.name, githubLogin: user?.githubLogin }));
  console.log("githubAccessToken on User:", user?.githubAccessToken ? "SET" : "NULL");
  console.log("Accounts:", user?.accounts?.map((a) => ({ provider: a.provider, hasToken: !!a.access_token })));

  if (user) {
    const events = await prisma.gitHubEvent.count({ where: { userId: user.id } });
    const digest = await prisma.digest.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: "desc" },
    });
    console.log("GitHub events in DB:", events);
    console.log("Digest exists:", !!digest);
    console.log("Digest summaryText length:", digest?.summaryText?.length ?? 0);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
