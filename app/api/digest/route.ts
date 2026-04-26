import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Optional ?since=<ISO> — only return a digest generated after that timestamp
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  const digest = await prisma.digest.findFirst({
    where: {
      userId: session.user.id,
      coverDate: { gte: today },
      ...(since ? { generatedAt: { gte: since } } : {}),
    },
    orderBy: { generatedAt: "desc" },
  });

  if (!digest) {
    return NextResponse.json({ error: "No digest found" }, { status: 404 });
  }

  return NextResponse.json(digest);
}
