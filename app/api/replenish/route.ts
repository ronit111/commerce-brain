import { NextResponse } from "next/server";
import { runTurn } from "@/src/agents/orchestrator";
import { getSession } from "@/src/lib/session-store";
import { resolveMode } from "@/src/lib/mode";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Agent-INITIATED replenishment. This is the "Sunday 6 PM" nudge: no shopper
// message triggers it — the Replenishment agent drafts the weekly basket on a
// schedule, and the Margin agent + Trust Arbiter run over it. Same orchestrator
// as /api/chat; the only difference is that the shopper didn't ask.
//
// In production a cron/queue fires this per household and pushes the draft over
// WhatsApp. Here a button stands in for the schedule.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const { mock, apiKey } = resolveMode();
  let body: { sessionId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine for an agent-initiated trigger
  }
  const sessionId = body.sessionId?.trim() || "anon";

  try {
    const session = getSession(sessionId);
    // The deterministic replenishment intent, phrased as the agent would to itself.
    const result = await runTurn(session, "my usual weekly order", { mock, apiKey });
    return NextResponse.json({ ...result, agentInitiated: true });
  } catch (err) {
    console.error("replenish failed:", err);
    return NextResponse.json({ error: "Replenishment draft failed." }, { status: 500 });
  }
}
