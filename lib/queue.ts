import { Queue } from "bullmq";
import { env } from "@/lib/env";

const connection = { url: env.REDIS_URL };

export const syncQueue = new Queue("sync-queue", { connection });
export const digestQueue = new Queue("digest-queue", { connection });
