import { Queue } from "bullmq";

async function main(): Promise<void> {
  const REDIS_URL = process.env.REDIS_URL!;
  console.log("Connecting to Redis:", REDIS_URL.replace(/:\/\/[^@]+@/, "://***@"));

  const queue = new Queue("sync-queue", { connection: { url: REDIS_URL } });

  const job = await queue.add("syncUser", { userId: "cmnxf8uuz00002mx29pfk17qx" });
  console.log("Job added, id:", job.id);

  const counts = await queue.getJobCounts();
  console.log("Queue counts:", counts);

  await queue.close();
}

main().catch(console.error);
