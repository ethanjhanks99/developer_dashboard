import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      completed: false,
      OR: [{ dueDate: { lte: today } }, { dueDate: null }],
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
  });

  return NextResponse.json(tasks);
}
