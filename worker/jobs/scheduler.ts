import { syncQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";

export async function runScheduler(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });

  await Promise.all(
    users.map((user) =>
      syncQueue.add("syncUser", { userId: user.id }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      })
    )
  );

  console.info({ msg: `Scheduler: enqueued ${users.length} sync jobs` });
}
