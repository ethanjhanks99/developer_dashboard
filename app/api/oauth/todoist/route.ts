import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TODOIST_AUTH_URL = "https://todoist.com/oauth/authorize";
const TODOIST_TOKEN_URL = "https://todoist.com/oauth/access_token";
const SCOPES = "data:read";

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (code) {
    const sessionState = req.cookies.get("oauth_state_todoist")?.value;
    if (!state || state !== sessionState) {
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    const tokenRes = await fetch(TODOIST_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.TODOIST_CLIENT_ID!,
        client_secret: process.env.TODOIST_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/todoist`,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    await prisma.connectedAccount.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "todoist" } },
      create: {
        userId: session.user.id,
        provider: "todoist",
        accessToken: tokens.access_token,
        needsReauth: false,
      },
      update: {
        accessToken: tokens.access_token,
        needsReauth: false,
      },
    });

    const response = NextResponse.redirect(new URL("/settings", req.nextUrl.origin));
    response.cookies.delete("oauth_state_todoist");
    return response;
  }

  const oauthState = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.TODOIST_CLIENT_ID!,
    scope: SCOPES,
    state: oauthState,
  });

  const response = NextResponse.redirect(`${TODOIST_AUTH_URL}?${params}`);
  response.cookies.set("oauth_state_todoist", oauthState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  });
  return response;
}
