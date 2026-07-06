import { NextRequest, NextResponse } from "next/server";
import { runTurn } from "@/src/agents/orchestrator";
import { getSession, resetSession } from "@/src/lib/session-store";
import { resolveMode } from "@/src/lib/mode";

export const runtime = "nodejs";

// --- Per-IP rate limit (live mode only; mock mode is free/offline) -----------
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const { mock, apiKey } = resolveMode();

  let body: { sessionId?: string; message?: string; reset?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim() || "anon";
  if (body.reset) {
    resetSession(sessionId);
    return NextResponse.json({ ok: true });
  }

  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Empty message." }, { status: 400 });
  if (message.length > 500) {
    return NextResponse.json({ error: "Message too long (500 char cap)." }, { status: 400 });
  }

  // Rate limiting protects the paid path; mock mode calls no LLM so it's exempt.
  if (!mock && rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  try {
    const session = getSession(sessionId);
    const result = await runTurn(session, message, { mock, apiKey });
    return NextResponse.json(result);
  } catch (err) {
    console.error("chat turn failed:", err);
    return NextResponse.json({ error: "Agent turn failed." }, { status: 500 });
  }
}

export async function GET() {
  const { mock } = resolveMode();
  return NextResponse.json({ ok: true, mode: mock ? "mock" : "live" });
}
