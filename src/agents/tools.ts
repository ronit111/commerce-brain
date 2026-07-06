import { CATALOG, getSku } from "@/src/data/catalog";
import type { DietaryTag, Household } from "@/src/data/types";
import type {
  ArbiterRuling,
  Basket,
  MarginCandidate,
  TraceEntry,
} from "@/src/lib/types";
import { addItem, emptyBasket, recompute, removeItem, skuIds, swapItem } from "@/src/lib/basket";
import { getMarginCandidates } from "./margin";
import { arbitrateBasket } from "./trust-arbiter";
import { draftReplenishment } from "./replenishment";
import { SLM_MODEL } from "./registry";

// ===========================================================================
// TOOLS
//
// The concierge's tool-calling loop dispatches into these. Each tool is backed
// by a specialist agent: search_catalog → Discovery, update_basket → Basket
// Builder, check_budget → Budget & Substitution, get_offers → Margin + Trust
// Arbiter + Inventory. Tools mutate a shared ToolContext (the session) and push
// a trace entry so the Retailer Lens can show exactly which agent fired.
// ===========================================================================

export interface ToolContext {
  basket: Basket;
  household: Household;
  trace: TraceEntry[];
  rulings: ArbiterRuling[];
}

// Anthropic tool schema — the concierge is given exactly these.
export const TOOL_SPECS = [
  {
    name: "search_catalog",
    description:
      "Search the Apna Aisle catalog for items matching a need. Returns real SKUs with price and unit price. Use for any product discovery.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "keywords, e.g. 'paneer' or 'veg dinner'" },
        category: { type: "string", description: "optional category filter" },
        dietary: {
          type: "array",
          items: { type: "string" },
          description: "dietary tags that MUST be satisfied, e.g. ['veg']",
        },
        maxUnitPrice: { type: "number", description: "optional cap on ₹ per kg/L/pc" },
        maxResults: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "update_basket",
    description: "Add or remove items from the shopper's basket. Quantities are pack counts.",
    input_schema: {
      type: "object" as const,
      properties: {
        add: {
          type: "array",
          items: {
            type: "object",
            properties: { skuId: { type: "string" }, qty: { type: "number" } },
            required: ["skuId", "qty"],
          },
        },
        remove: { type: "array", items: { type: "string" }, description: "skuIds to remove" },
      },
    },
  },
  {
    name: "check_budget",
    description: "Check the basket total against a rupee cap; if over, suggests cheaper equivalents.",
    input_schema: {
      type: "object" as const,
      properties: { cap: { type: "number", description: "budget cap in ₹" } },
      required: ["cap"],
    },
  },
  {
    name: "get_offers",
    description:
      "Fetch this week's vetted savings/substitution offers for the current basket. Runs the Margin agent and Trust Arbiter; APPROVED offers are applied to the basket (cheaper swaps, expiry discounts) and returned with their shopper 'why'. Blocked offers are withheld. Set focus='expiry' to only surface expiring-item discounts.",
    input_schema: {
      type: "object" as const,
      properties: { focus: { type: "string", enum: ["all", "expiry"] } },
    },
  },
  {
    name: "get_replenishment_draft",
    description:
      "Build the household's usual weekly basket from its consumption history (deterministic forecast). Adds all due items to the basket and returns the draft.",
    input_schema: { type: "object" as const, properties: {} },
  },
] as const;

// ---- Tool implementations -------------------------------------------------

export function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): string {
  switch (name) {
    case "search_catalog":
      return searchCatalog(input, ctx);
    case "update_basket":
      return updateBasket(input, ctx);
    case "check_budget":
      return checkBudget(input, ctx);
    case "get_offers":
      return getOffers(input, ctx);
    case "get_replenishment_draft":
      return getReplenishmentDraft(ctx);
    default:
      return `ERROR: unknown tool ${name}`;
  }
}

// Discovery agent: keyword + tag + unit-price search over the catalog.
function searchCatalog(input: Record<string, unknown>, ctx: ToolContext): string {
  const query = String(input.query ?? "").toLowerCase();
  const dietary = (input.dietary as DietaryTag[] | undefined) ?? [];
  const category = input.category as string | undefined;
  const maxUnitPrice = input.maxUnitPrice as number | undefined;
  const maxResults = (input.maxResults as number | undefined) ?? 8;
  const terms = query.split(/\s+/).filter(Boolean);

  const results = CATALOG.filter((s) => {
    if (category && s.category !== category) return false;
    if (maxUnitPrice && s.unitPrice > maxUnitPrice) return false;
    if (dietary.some((d) => !s.dietaryTags.includes(d))) return false;
    if (terms.length === 0) return true;
    const hay = `${s.name} ${s.brand} ${s.category}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  }).slice(0, maxResults);

  ctx.trace.push({
    agent: "discovery",
    tier: "frontier",
    action: "searched catalog",
    detail: `"${query}" → ${results.length} candidates`,
    data: results.map((r) => r.id),
  });

  if (results.length === 0) return `No catalog items matched "${query}".`;
  return results
    .map(
      (s) =>
        `${s.id} | ${s.name} (${s.brand}) | ${s.packSize} | ₹${s.price} | ₹${s.unitPrice}/${s.unit} | ${s.dietaryTags.join(",")}`,
    )
    .join("\n");
}

// Basket Builder: apply adds/removes.
function updateBasket(input: Record<string, unknown>, ctx: ToolContext): string {
  const add = (input.add as Array<{ skuId: string; qty: number }>) ?? [];
  const remove = (input.remove as string[]) ?? [];
  for (const a of add) {
    if (getSku(a.skuId)) ctx.basket = addItem(ctx.basket, a.skuId, a.qty);
  }
  for (const r of remove) ctx.basket = removeItem(ctx.basket, r);
  ctx.trace.push({
    agent: "basket-builder",
    tier: "frontier",
    action: "updated basket",
    detail: `+${add.length} / -${remove.length} → ${ctx.basket.items.length} lines, ₹${ctx.basket.total}`,
  });
  return `Basket now: ${ctx.basket.items.length} lines, total ₹${ctx.basket.total}.`;
}

// Budget & Substitution agent: over-budget → propose cheaper same-category swaps.
function checkBudget(input: Record<string, unknown>, ctx: ToolContext): string {
  const cap = Number(input.cap);
  const over = ctx.basket.total - cap;
  ctx.trace.push({
    agent: "budget-substitution",
    tier: "frontier",
    action: "checked budget",
    detail: `total ₹${ctx.basket.total} vs cap ₹${cap} → ${over > 0 ? `over by ₹${over}` : "within budget"}`,
  });
  if (over <= 0) return `Within budget: total ₹${ctx.basket.total} ≤ cap ₹${cap}.`;

  // Suggest the cheapest same-category equivalent for the priciest lines.
  const suggestions: string[] = [];
  for (const line of [...ctx.basket.items].sort((a, b) => b.lineTotal - a.lineTotal)) {
    const cur = getSku(line.skuId);
    if (!cur) continue;
    const cheaper = CATALOG.filter(
      (s) => s.category === cur.category && s.id !== cur.id && s.price < cur.price && s.stock > 0,
    ).sort((a, b) => a.price - b.price)[0];
    if (cheaper) {
      suggestions.push(
        `swap ${cur.name} (₹${cur.price}) → ${cheaper.name} (₹${cheaper.price}), save ₹${(cur.price - cheaper.price) * line.qty}`,
      );
    }
    if (suggestions.length >= 3) break;
  }
  return `Over budget by ₹${over}. Cheaper equivalents:\n${suggestions.join("\n") || "none found"}`;
}

// Margin + Trust Arbiter + Inventory. This is the two-sided core.
function getOffers(input: Record<string, unknown>, ctx: ToolContext): string {
  const focus = (input.focus as "all" | "expiry" | undefined) ?? "all";
  const candidates: MarginCandidate[] = getMarginCandidates(skuIds(ctx.basket), { focus });

  ctx.trace.push({
    agent: "margin",
    tier: "deterministic",
    action: "ranked margin candidates",
    detail: `${candidates.length} candidate steer(s) proposed`,
    data: candidates,
  });

  // Every candidate passes through the deterministic arbiter (rules R1–R5).
  // Only the surfaced (approved, within the R5 steer budget) ones are applied.
  const { rulings, surfaced } = arbitrateBasket(candidates, ctx.household);
  const surfacedIds = new Set(surfaced.map((c) => c.id));
  const approvedForShopper: string[] = [];

  for (const ruling of rulings) {
    ctx.rulings.push(ruling);
    ctx.trace.push({
      agent: "trust-arbiter",
      tier: "deterministic",
      action:
        ruling.decision === "approved"
          ? "approved steer"
          : ruling.decision === "queued"
            ? "queued steer"
            : "blocked steer",
      detail: `${ruling.steerSummary} — [${ruling.blockedByRule ?? "passed R1–R5"}] ${ruling.reason}`,
      data: ruling,
    });
  }

  for (const c of surfaced) {
    if (!surfacedIds.has(c.id)) continue;
    // Apply the approved offer to the basket so savings are visible.
    if (c.type === "private-label-swap" && c.fromSkuId) {
      ctx.basket = swapItem(ctx.basket, c.fromSkuId, c.toSkuId);
    } else if (c.type === "expiry-clearance") {
      ctx.basket = applyExpiryDiscount(ctx.basket, c.toSkuId);
    } else if (c.type === "attach") {
      ctx.basket = addItem(ctx.basket, c.toSkuId, 1);
    }
    approvedForShopper.push(`${c.whyShopper}`);
  }

  ctx.basket = recompute(ctx.basket);
  if (approvedForShopper.length === 0) {
    return "No shopper-safe offers to present right now (any candidates were withheld by the Trust Arbiter).";
  }
  return `Approved offers applied. Present these to the shopper (each with its why):\n- ${approvedForShopper.join("\n- ")}\nBasket total now ₹${ctx.basket.total}, savings ₹${ctx.basket.savings}.`;
}

function applyExpiryDiscount(basket: Basket, skuId: string): Basket {
  const sku = getSku(skuId);
  const line = basket.items.find((i) => i.skuId === skuId);
  if (!sku || !line || !sku.expiryDiscountPct) return basket;
  const newPrice = Math.round(sku.price * (1 - sku.expiryDiscountPct));
  const saved = (line.price - newPrice) * line.qty;
  line.price = newPrice;
  line.lineTotal = newPrice * line.qty;
  const next = recompute(basket);
  next.savings = Math.round(basket.savings + Math.max(0, saved));
  return next;
}

// Replenishment agent (deterministic): draft the usual weekly basket.
function getReplenishmentDraft(ctx: ToolContext): string {
  const due = draftReplenishment(ctx.household);
  // A draft is a fresh proposal, not an increment: replace whatever is in the
  // basket so re-running "my usual order" never double-adds.
  ctx.basket = emptyBasket();
  for (const item of due) ctx.basket = addItem(ctx.basket, item.skuId, item.qty);
  ctx.basket = recompute(ctx.basket);
  ctx.trace.push({
    agent: "replenishment",
    tier: "deterministic",
    action: "drafted replenishment basket",
    detail: `${due.length} due item(s) from consumption model`,
    data: due,
  });
  return (
    `Drafted ${due.length} usual items (deterministic forecast):\n` +
    due.map((d) => `${d.qty}× ${d.name} — ${d.reason}`).join("\n") +
    `\nBasket total ₹${ctx.basket.total}.`
  );
}

// SLM-tier intent classifier. In live mode this is a cheap Haiku call; here the
// keyword fallback keeps it deterministic and free. Either way it's the "SLM
// tier" step from the model-strategy slide — 1 cheap call per turn.
export const INTENTS = ["plan_meal", "replenish", "substitute", "budget", "general"] as const;
export type Intent = (typeof INTENTS)[number];

export function classifyIntentHeuristic(message: string): Intent {
  const m = message.toLowerCase();
  if (/(usual|weekly order|replenish|restock|my order|sunday)/.test(m)) return "replenish";
  if (/(expir|expiring|discount|swap|substitut|cheaper|out of stock)/.test(m)) return "substitute";
  if (/(plan|dinner|lunch|meal|recipe|cook|make)/.test(m)) return "plan_meal";
  if (/(budget|under ₹|under rs|below|cheap|save)/.test(m)) return "budget";
  return "general";
}

export const INTENT_SLM_MODEL = SLM_MODEL;
