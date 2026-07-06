import type { DietaryTag } from "@/src/data/types";

// ---------------------------------------------------------------------------
// Runtime types: the conversation, the basket, and the "glass box" trace that
// the Retailer Lens renders. Every agent action that matters ends up in a
// Trace entry so the two-sided story is inspectable, not asserted.
// ---------------------------------------------------------------------------

export type Role = "shopper" | "concierge";

export interface ChatMessage {
  role: Role;
  text: string;
}

export interface BasketItem {
  skuId: string;
  name: string;
  brand: string;
  qty: number;
  price: number; // effective per-unit price (post any expiry discount)
  lineTotal: number;
}

export interface Basket {
  items: BasketItem[];
  total: number;
  savings: number; // rupees saved vs the pre-optimisation baseline
}

// Which model tier an agent runs on — mirrors the model-strategy slide.
// "frontier" = frontier-model reasoning tier; "slm" = small/cheap classifier;
// "deterministic" = no LLM at all (forecast, ranking, policy).
export type ModelTier = "frontier" | "slm" | "deterministic";

export type AgentName =
  | "concierge"
  | "discovery"
  | "basket-builder"
  | "replenishment"
  | "budget-substitution"
  | "margin"
  | "inventory"
  | "trust-arbiter"
  | "checkout"
  | "insights";

// A Trust Arbiter ruling on a single retailer-side steer.
// "queued" = passed every rule but exceeded the per-basket steer budget (R5);
// it isn't unsafe, just deferred to next week's draft.
export type ArbiterDecision = "approved" | "blocked" | "queued";

export interface ArbiterRuling {
  candidateId: string;
  decision: ArbiterDecision;
  steerSummary: string; // e.g. "Swap Aashirvaad Atta → Apna Select Atta"
  whyShopper: string; // the shopper-facing reason (required on every steer)
  rulesChecked: string[]; // rule ids evaluated
  blockedByRule?: string; // rule id that blocked/queued it, if any
  reason: string; // human-readable ruling explanation
  score?: number; // soft-tradeoff score (transparency only; never blocks)
}

// One entry in the glass-box trace surfaced by the Retailer Lens.
export interface TraceEntry {
  agent: AgentName;
  tier: ModelTier;
  action: string; // short verb phrase, e.g. "classified intent"
  detail: string; // one-line human summary
  data?: unknown; // structured payload (margin candidates, ruling, etc.)
}

// A margin candidate the Margin agent produced, pre-arbitration.
export interface MarginCandidate {
  id: string;
  type: "private-label-swap" | "expiry-clearance" | "attach";
  fromSkuId?: string;
  toSkuId: string;
  whyShopper: string; // shopper-facing "why" — never contains margin numbers
  useBy?: string; // use-by date for expiry-clearance steers (R4 requires it)
  marginReason: string; // internal reason (retailer lens only)
  marginDeltaPct: number; // internal: margin gain, retailer lens only
}

export type Mode = "mock" | "live";

// The full result of one orchestrated turn.
export interface TurnResult {
  reply: string;
  basket: Basket;
  trace: TraceEntry[];
  rulings: ArbiterRuling[];
  mode: Mode;
  intent: string;
}

export interface ShopperContext {
  dietaryPrefs: DietaryTag[];
  allergies: DietaryTag[];
}
