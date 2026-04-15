import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncQueue } from "@/lib/queue";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncQueue.add("syncUser", { userId: session.user.id });

  return NextResponse.json({ queued: true });
}
