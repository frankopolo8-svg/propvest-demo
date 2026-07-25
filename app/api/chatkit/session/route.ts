import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const CHATKIT_SESSION_COOKIE = "propvest_chatkit_demo_user_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const OPENAI_CHATKIT_SESSIONS_URL = "https://api.openai.com/v1/chatkit/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.OPENAI_CHATKIT_WORKFLOW_ID;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable" },
      { status: 500 },
    );
  }

  if (!workflowId) {
    return NextResponse.json(
      { error: "Missing OPENAI_CHATKIT_WORKFLOW_ID environment variable" },
      { status: 500 },
    );
  }

  const existingUserId = readCookie(request, CHATKIT_SESSION_COOKIE);
  const userId = existingUserId || `demo_${randomUUID()}`;

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CHATKIT_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: userId,
      }),
    });
  } catch (error) {
    return withDemoUserCookie(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to reach OpenAI" },
        { status: 502 },
      ),
      existingUserId,
      userId,
    );
  }

  const session = (await upstream.json().catch(() => ({}))) as {
    client_secret?: string;
    error?: { message?: string } | string;
  };

  if (!upstream.ok) {
    const message =
      typeof session.error === "string"
        ? session.error
        : session.error?.message || upstream.statusText || "Failed to create ChatKit session";

    return withDemoUserCookie(
      NextResponse.json({ error: message }, { status: upstream.status }),
      existingUserId,
      userId,
    );
  }

  if (!session.client_secret) {
    return withDemoUserCookie(
      NextResponse.json(
        { error: "OpenAI response did not include a ChatKit client secret" },
        { status: 502 },
      ),
      existingUserId,
      userId,
    );
  }

  return withDemoUserCookie(
    NextResponse.json({ client_secret: session.client_secret }),
    existingUserId,
    userId,
  );
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return undefined;

  const value = cookie.slice(name.length + 1);
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function withDemoUserCookie(response: NextResponse, existingUserId: string | undefined, userId: string) {
  if (!existingUserId) {
    response.cookies.set(CHATKIT_SESSION_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
  }

  return response;
}
