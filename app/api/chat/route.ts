import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { env } from "@/lib/env";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { message: string; history?: ChatMessage[] };
  const { message, history = [] } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
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

  const digestContext = digest
    ? `Today's digest:\n\n${digest.summaryText}`
    : "No digest has been generated for today yet.";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    { role: "user", content: digestContext },
    { role: "assistant", content: "Got it. What would you like to know?" },
    ...history.slice(-20),
    { role: "user", content: message.slice(0, 600) },
  ];

  const stream = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
