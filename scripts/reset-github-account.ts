import { PrismaClient } from "../app/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const deleted = await prisma.account.deleteMany({ where: { provider: "github" } });
  console.log("Deleted stale GitHub account rows:", deleted.count);
  console.log("Sign back in to get a fresh token with repo scope.");

  await prisma.$disconnect();
}

main().catch(console.error);
