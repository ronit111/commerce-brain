import type { AgentName, ModelTier } from "@/src/lib/types";

// ===========================================================================
// AGENT REGISTRY
//
// One declarative definition per agent in the Commerce Brain. This is the
// single source of truth for "who does what, on which model tier, with which
// tools." The orchestrator reads the concierge's definition to drive the live
// tool-calling loop; the specialist definitions document contracts and back the
// tools the concierge calls.
//
// Model tiers mirror the model-strategy slide:
//   frontier      → hosted frontier model: orchestration + multi-constraint reasoning
//   slm           → small/cheap model: high-volume classification
//   deterministic → no LLM at all: forecasting, ranking, policy
// ===========================================================================

export interface AgentDefinition {
  name: AgentName;
  title: string;
  side: "shopper" | "retailer" | "referee";
  tier: ModelTier;
  model?: string; // concrete model id when the agent runs an LLM
  role: string; // one-line responsibility
  systemPrompt: string; // used when the agent runs an LLM
  tools: string[]; // tool names this agent may call
  deterministicModule?: string; // path to the code, for deterministic agents
}

export const FRONTIER_MODEL = process.env.FRONTIER_MODEL ?? "claude-sonnet-5"; // frontier tier — env-overridable; provider is a deployment decision
export const SLM_MODEL = process.env.SLM_MODEL ?? "claude-haiku-4-5-20251001"; // SLM tier — env-overridable

export const AGENTS: Record<AgentName, AgentDefinition> = {
  concierge: {
    name: "concierge",
    title: "Concierge (Orchestrator)",
    side: "shopper",
    tier: "frontier",
    model: FRONTIER_MODEL,
    role: "Owns the conversation, routes intent to specialists, composes one reply in the retailer's voice.",
    systemPrompt: [
      "You are the Concierge for Apna Aisle, an Indian online grocery. You help a household shop by chat.",
      "You are warm, concise, and never pushy. Prices are in rupees (₹).",
      "You DO NOT invent products, prices, or stock. You use tools to find real catalog items, build the basket, check budgets, and surface retailer offers.",
      "To find items call search_catalog. To add/remove items call update_basket. To check a budget call check_budget.",
      "To fetch this week's savings/substitution offers call get_offers — these have ALREADY been vetted by the Trust Arbiter, so you may present the approved ones as honest suggestions, always including their 'why'.",
      "Never mention margins, retailer economics, or that a suggestion helps the store. Frame every suggestion purely by shopper benefit (cheaper, fresher, discounted).",
      "When you have finished acting, write a short friendly reply summarising what you did and the basket total.",
    ].join("\n"),
    tools: ["search_catalog", "update_basket", "check_budget", "get_offers", "get_replenishment_draft"],
  },

  discovery: {
    name: "discovery",
    title: "Discovery Agent",
    side: "shopper",
    tier: "frontier",
    model: FRONTIER_MODEL,
    role: "Catalog retrieval + preference memory: turns 'dinner for 4 under ₹800' into candidate SKUs.",
    systemPrompt:
      "Given a natural-language need, retrieve candidate catalog SKUs that satisfy it, honouring dietary tags and unit-price budget. Return ranked candidates; never fabricate SKUs.",
    tools: ["search_catalog"],
    deterministicModule: "src/agents/tools.ts (search implementation over catalog)",
  },

  "basket-builder": {
    name: "basket-builder",
    title: "Basket Builder",
    side: "shopper",
    tier: "frontier",
    model: FRONTIER_MODEL,
    role: "Meal-plan-to-basket and quantity logic (household size, pack sizes).",
    systemPrompt:
      "Convert a meal plan or item list into concrete basket lines with sensible quantities for the household size and available pack sizes.",
    tools: ["update_basket"],
  },

  replenishment: {
    name: "replenishment",
    title: "Replenishment Agent (autopilot spine)",
    side: "shopper",
    tier: "deterministic",
    role: "Per-household consumption model drafts the weekly basket before the shopper asks. No LLM invents a forecast.",
    systemPrompt:
      "(Deterministic) Predict due items from median purchase cadence. The LLM only explains/negotiates the draft; it never forecasts.",
    tools: ["get_replenishment_draft"],
    deterministicModule: "src/agents/replenishment.ts",
  },

  "budget-substitution": {
    name: "budget-substitution",
    title: "Budget & Substitution Agent",
    side: "shopper",
    tier: "frontier",
    model: FRONTIER_MODEL,
    role: "Unit-price (₹/kg) reasoning, budget caps, dietary/allergy constraints, honest out-of-stock swaps.",
    systemPrompt:
      "Reason on unit price (₹/kg, ₹/L), keep the basket under budget, honour dietary and allergy constraints, and propose honest substitutions when items are unavailable.",
    tools: ["check_budget", "search_catalog", "update_basket"],
  },

  margin: {
    name: "margin",
    title: "Margin Agent",
    side: "retailer",
    tier: "deterministic",
    role: "Ranks private-label attach, expiry-risk placement, and promos into candidate steers. Never sees the shopper directly.",
    systemPrompt:
      "(Deterministic) Rank retailer-side steers over margin/inventory metadata. Emit candidates with a shopper-facing 'why' that contains no margin numbers. Every candidate must pass the Trust Arbiter before use.",
    tools: ["get_offers"],
    deterministicModule: "src/agents/margin.ts",
  },

  inventory: {
    name: "inventory",
    title: "Inventory Agent",
    side: "retailer",
    tier: "deterministic",
    role: "Dark-store stock awareness; fill-rate-aware substitution before order confirmation.",
    systemPrompt:
      "(Deterministic) Check dark-store stock and flag out-of-stock lines with in-stock equivalents before checkout, to kill the doorstep-substitution surprise.",
    tools: ["search_catalog"],
    deterministicModule: "src/agents/tools.ts (stock checks over catalog)",
  },

  "trust-arbiter": {
    name: "trust-arbiter",
    title: "Trust Arbiter (Referee)",
    side: "referee",
    tier: "deterministic",
    role: "Adjudicates every retailer-side steer against hard rules + a scored trade-off model before it reaches the shopper.",
    systemPrompt:
      "(Deterministic policy engine) Hard rules: never override dietary/allergy; never suppress a cheaper equivalent already chosen; every steer needs a 'why'. Soft cases scored. Rulings are logged and shown in the Retailer Lens.",
    tools: [],
    deterministicModule: "src/agents/trust-arbiter.ts",
  },

  checkout: {
    name: "checkout",
    title: "Checkout Agent (stub)",
    side: "shopper",
    tier: "deterministic",
    role: "UPI Autopay mandate + slot booking for agent-initiated orders. Stubbed in this prototype.",
    systemPrompt:
      "(Stub) Would execute a UPI Autopay e-mandate for autopilot orders and book a delivery slot. Not wired to real payment rails here.",
    tools: [],
    deterministicModule: "src/agents/checkout.ts",
  },

  insights: {
    name: "insights",
    title: "Insights Agent (stub)",
    side: "retailer",
    tier: "frontier",
    model: FRONTIER_MODEL,
    role: "Retailer-facing weekly digest of what the shopper agents learned; merchandising recommendations. Stubbed.",
    systemPrompt:
      "(Stub) Would summarise, for a category manager, agent-attributed margin, steer acceptance, and forecast accuracy for the week.",
    tools: [],
    deterministicModule: "src/agents/insights.ts",
  },
};

export const AGENT_LIST = Object.values(AGENTS);
