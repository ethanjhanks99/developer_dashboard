import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setHours(since.getHours() - 24);

  const events = await prisma.gitHubEvent.findMany({
    where: {
      userId: session.user.id,
      eventAt: { gte: since },
    },
    orderBy: { eventAt: "desc" },
    take: 50,
  });

  return NextResponse.json(events);
}
