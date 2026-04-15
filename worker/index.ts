import { Worker } from "bullmq";
import { env } from "@/lib/env";
import { syncUser } from "./jobs/syncUser";
import { generateDigest } from "./jobs/generateDigest";
import { runScheduler } from "./jobs/scheduler";

const connection = { url: env.REDIS_URL };

const RETRY_CONFIG = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
};

const syncWorker = new Worker(
  "sync-queue",
  async (job) => {
    try {
      await syncUser(job);
    } catch (err) {
      console.error({ jobId: job.id, userId: job.data?.userId, err });
      throw err;
    }
  },
  {
    connection,
    defaultJobOptions: {
      ...RETRY_CONFIG,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }
);

const digestWorker = new Worker(
  "digest-queue",
  async (job) => {
    try {
      await generateDigest(job);
    } catch (err) {
      console.error({ jobId: job.id, userId: job.data?.userId, err });
      throw err;
    }
  },
  {
    connection,
    defaultJobOptions: {
      ...RETRY_CONFIG,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }
);

// Daily cron scheduler — 6:00 AM
const CRON_SCHEDULE = "0 6 * * *";

async function startScheduler(): Promise<void> {
  const { Queue } = await import("bullmq");
  const schedulerQueue = new Queue("scheduler-queue", { connection });

  await schedulerQueue.add(
    "dailySync",
    {},
    {
      repeat: { pattern: CRON_SCHEDULE },
      removeOnComplete: 10,
      removeOnFail: 50,
    }
  );

  new Worker(
    "scheduler-queue",
    async () => {
      await runScheduler();
    },
    { connection }
  );
}

startScheduler().catch(console.error);

console.info("Worker process started");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await Promise.all([syncWorker.close(), digestWorker.close()]);
  process.exit(0);
});
