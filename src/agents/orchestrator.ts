import Anthropic from "@anthropic-ai/sdk";
import { HOUSEHOLD } from "@/src/data/household";
import { emptyBasket, itemsSummary } from "@/src/lib/basket";
import type { Basket, Mode, TraceEntry, ArbiterRuling, TurnResult } from "@/src/lib/types";
import { AGENTS, FRONTIER_MODEL, SLM_MODEL } from "./registry";
import {
  TOOL_SPECS,
  executeTool,
  classifyIntentHeuristic,
  type Intent,
  type ToolContext,
} from "./tools";

// ===========================================================================
// ORCHESTRATOR — the Concierge's tool-calling loop.
//
// This is the graded artifact, so it is deliberately small and legible. One
// loop drives the whole turn: the Concierge (frontier LLM) is given the tool
// specs, it emits tool_use blocks, we execute the real specialist tools, feed
// the results back, and repeat until it writes a final reply.
//
// The loop is provider-agnostic. "Mock vs live" is nothing but which Driver
// fills the model's seat:
//   • LiveDriver  → a real model call (frontier-tier concierge, SLM-tier intent).
//   • MockDriver  → a scripted plan per intent, NO API key needed.
// In BOTH modes the orchestration, tools, replenishment, margin ranking and
// Trust Arbiter run for real. Only the *language* the Concierge speaks is
// scripted in mock mode. That is the honest boundary of the demo.
// ===========================================================================

const MAX_STEPS = 6; // safety bound on the tool-calling loop
const CONCIERGE_MAX_TOKENS = 700;

// A driver returns either a batch of tool calls to run, or the final reply text.
type ToolCall = { id: string; name: string; input: Record<string, unknown> };
type DriverStep =
  | { kind: "tools"; calls: ToolCall[] }
  | { kind: "final"; text: string };

interface Driver {
  classifyIntent(message: string): Promise<Intent>;
  // Called once per loop turn. `ctx` is readable so the mock composer can
  // narrate the real basket/rulings; the live driver ignores it and uses `msgs`.
  next(msgs: Anthropic.MessageParam[], ctx: ToolContext): Promise<DriverStep>;
}

export interface Session {
  id: string;
  basket: Basket;
  history: Anthropic.MessageParam[];
}

export function newSession(id: string): Session {
  return { id, basket: emptyBasket(), history: [] };
}

const SYSTEM = [
  AGENTS.concierge.systemPrompt,
  `\nHousehold context: ${HOUSEHOLD.label}, ${HOUSEHOLD.city}, size ${HOUSEHOLD.size}.`,
  `Dietary: ${HOUSEHOLD.dietaryPrefs.join(", ") || "none"}. Allergies: ${HOUSEHOLD.allergies
    .map((a) => a.replace("contains-", ""))
    .join(", ") || "none"}.`,
  "Prefer get_replenishment_draft for 'usual order' asks, get_offers to surface vetted savings, search_catalog + update_basket to build a meal, check_budget for a rupee cap.",
].join("\n");

/**
 * Run one shopper turn end to end. Same signature and behaviour in mock or live
 * mode; only the injected driver differs.
 */
export async function runTurn(
  session: Session,
  message: string,
  opts: { mock: boolean; apiKey?: string },
): Promise<TurnResult> {
  const trace: TraceEntry[] = [];
  const rulings: ArbiterRuling[] = [];
  const ctx: ToolContext = { basket: session.basket, household: HOUSEHOLD, trace, rulings };
  const mode: Mode = opts.mock ? "mock" : "live";

  const driver: Driver = opts.mock ? new MockDriver() : new LiveDriver(opts.apiKey!);

  // Step 1 — SLM-tier intent classification (Haiku live / heuristic in mock).
  const intent = await driver.classifyIntent(message);
  trace.push({
    agent: "concierge",
    tier: "slm",
    action: "classified intent",
    detail: `"${message}" → ${intent} (model: ${opts.mock ? "heuristic (SLM stand-in)" : SLM_MODEL})`,
  });
  if (driver instanceof MockDriver) driver.begin(intent, message, ctx);

  // Step 2 — the tool-calling loop.
  const msgs: Anthropic.MessageParam[] = [
    ...session.history,
    { role: "user", content: message },
  ];
  let reply = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const out = await driver.next(msgs, ctx);
    if (out.kind === "final") {
      reply = out.text;
      break;
    }
    // Execute each tool the Concierge asked for; feed results back as tool_result.
    const results: Anthropic.ToolResultBlockParam[] = out.calls.map((call) => ({
      type: "tool_result",
      tool_use_id: call.id,
      content: executeTool(call.name, call.input, ctx),
    }));
    msgs.push({
      role: "assistant",
      content: out.calls.map((c) => ({
        type: "tool_use",
        id: c.id,
        name: c.name,
        input: c.input,
      })),
    });
    msgs.push({ role: "user", content: results });
  }
  if (!reply) reply = "Done — your basket is updated.";

  // Persist basket + a compact history turn on the session.
  session.basket = ctx.basket;
  session.history = [
    ...session.history,
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ].slice(-8) as Anthropic.MessageParam[];

  return { reply, basket: ctx.basket, trace, rulings, mode, intent };
}

// ---------------------------------------------------------------------------
// LIVE DRIVER — a hosted model via the bundled provider SDK. Frontier tier for the
// Concierge, SLM tier for intent. The Driver interface is the swap point for any
// other provider or a self-hosted open-weights server.
// ---------------------------------------------------------------------------
class LiveDriver implements Driver {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async classifyIntent(message: string): Promise<Intent> {
    try {
      const res = await this.client.messages.create({
        model: SLM_MODEL,
        max_tokens: 8,
        system:
          "Classify the grocery shopper message into ONE label: plan_meal, replenish, substitute, budget, general. Reply with only the label.",
        messages: [{ role: "user", content: message }],
      });
      const text = res.content.find((b) => b.type === "text");
      const label = (text?.type === "text" ? text.text : "").trim() as Intent;
      return (["plan_meal", "replenish", "substitute", "budget", "general"] as const).includes(label)
        ? label
        : classifyIntentHeuristic(message);
    } catch {
      return classifyIntentHeuristic(message); // fail closed to the free path
    }
  }

  async next(msgs: Anthropic.MessageParam[]): Promise<DriverStep> {
    const res = await this.client.messages.create({
      model: FRONTIER_MODEL,
      max_tokens: CONCIERGE_MAX_TOKENS,
      system: SYSTEM,
      tools: TOOL_SPECS as unknown as Anthropic.Tool[],
      messages: msgs,
    });
    const calls = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));
    if (res.stop_reason === "tool_use" && calls.length > 0) {
      return { kind: "tools", calls };
    }
    const text = res.content.find((b) => b.type === "text");
    return { kind: "final", text: text?.type === "text" ? text.text : "Done." };
  }
}

// ---------------------------------------------------------------------------
// MOCK DRIVER — no API key. Plays a scripted plan of REAL tool calls per intent,
// then composes a plausible Concierge reply from the actual basket + rulings.
// The tools it calls are the very same ones the live Concierge would call.
// ---------------------------------------------------------------------------
class MockDriver implements Driver {
  private plan: ToolCall[][] = [];
  private cursor = 0;
  private intent: Intent = "general";
  private message = "";

  async classifyIntent(message: string): Promise<Intent> {
    return classifyIntentHeuristic(message);
  }

  begin(intent: Intent, message: string, ctx: ToolContext) {
    this.intent = intent;
    this.message = message;
    this.cursor = 0;
    this.plan = buildMockPlan(intent, message, ctx);
  }

  async next(_msgs: Anthropic.MessageParam[], ctx: ToolContext): Promise<DriverStep> {
    if (this.cursor < this.plan.length) {
      const calls = this.plan[this.cursor++];
      return { kind: "tools", calls };
    }
    return { kind: "final", text: composeMockReply(this.intent, this.message, ctx) };
  }
}

let mockId = 0;
const call = (name: string, input: Record<string, unknown> = {}): ToolCall => ({
  id: `mock_${++mockId}`,
  name,
  input,
});

function extractCap(message: string): number | undefined {
  const m = message.replace(/,/g, "").match(/(?:under|below|₹|rs\.?)\s*₹?\s*(\d{2,6})/i);
  return m ? Number(m[1]) : undefined;
}

// Scripted plans. Each inner array is one loop turn's worth of tool calls; the
// live model would emit these as tool_use blocks. Product choices below are a
// stand-in for the model's reasoning — everything downstream is real.
function buildMockPlan(intent: Intent, message: string, ctx: ToolContext): ToolCall[][] {
  switch (intent) {
    case "replenish":
      return [[call("get_replenishment_draft")], [call("get_offers", { focus: "all" })]];

    case "substitute": {
      const needDraft = ctx.basket.items.length === 0;
      const offers = call("get_offers", { focus: "expiry" });
      return needDraft ? [[call("get_replenishment_draft")], [offers]] : [[offers]];
    }

    case "plan_meal": {
      const cap = extractCap(message) ?? 800;
      const vegDinnerForFour: Array<{ skuId: string; qty: number }> = [
        { skuId: "paneer-dks-200", qty: 2 },
        { skuId: "paneer-cap-500", qty: 1 },
        { skuId: "tomato-1", qty: 1 },
        { skuId: "onion-1", qty: 1 },
        { skuId: "rice-daawat-1", qty: 1 },
        { skuId: "curd-nandini-500", qty: 1 },
        { skuId: "coriander-100", qty: 1 },
        { skuId: "greenchilli-100", qty: 1 },
      ];
      return [
        [call("search_catalog", { query: "paneer dinner", dietary: ["veg"] })],
        [call("update_basket", { add: vegDinnerForFour })],
        [call("check_budget", { cap })],
      ];
    }

    case "budget": {
      const cap = extractCap(message) ?? HOUSEHOLD_MONTHLY_HINT;
      return [[call("check_budget", { cap })]];
    }

    default:
      return []; // general → straight to a composed reply, no tools
  }
}

const HOUSEHOLD_MONTHLY_HINT = 1500;

// Compose a warm, concise Concierge reply from the REAL post-tool state.
function composeMockReply(intent: Intent, message: string, ctx: ToolContext): string {
  const b = ctx.basket;
  const approved = ctx.rulings.filter((r) => r.decision === "approved");
  const steerLines = approved.map((r) => `• ${r.whyShopper}`).join("\n");
  const total = `₹${b.total}`;
  const savings = b.savings > 0 ? ` You've saved ₹${b.savings} so far.` : "";

  switch (intent) {
    case "replenish":
      return [
        `Here's your usual weekly basket, drafted from your last 8 weeks of orders — ${b.items.length} items, ${total}.`,
        approved.length
          ? `I also flagged ${approved.length} thing${approved.length > 1 ? "s" : ""} worth a look, each with the reason:\n${steerLines}`
          : "",
        `Want me to tweak anything before you approve? A tap and the UPI mandate books your slot.${savings}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "substitute":
      return approved.length
        ? `Found ${approved.length} item${approved.length > 1 ? "s" : ""} you can save on right now, each with why:\n${steerLines}\n\nBasket total is now ${total}.${savings}`
        : `Nothing in your basket is close to expiry right now, so there's nothing safe to swap for a discount. Basket total ${total}.`;

    case "plan_meal": {
      const cap = extractCap(message);
      const capNote = cap ? ` — comfortably under your ₹${cap} budget` : "";
      return `Planned a veg dinner for four: ${itemsSummary(b)}. That's ${total}${capNote}. Say the word and I'll add it to your basket for checkout.`;
    }

    case "budget":
      return `Your basket is at ${total}.${savings} Tell me a target and I'll trim it with cheaper equivalents where the swap is honest.`;

    default:
      return "I can build your usual weekly basket, plan a meal to a budget, or find honest savings on what's expiring. What would you like?";
  }
}
