import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const digest = await prisma.digest.findFirst({
    where: {
      userId: session.user.id,
      coverDate: { gte: today },
    },
    orderBy: { generatedAt: "desc" },
  });

  if (!digest) {
    return NextResponse.json({ error: "No digest found for today" }, { status: 404 });
  }

  return NextResponse.json(digest);
}
