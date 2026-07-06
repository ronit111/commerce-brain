import { CATALOG, getSku } from "@/src/data/catalog";
import { DEMO_NOW } from "@/src/data/household";
import type { Sku } from "@/src/data/types";
import type { MarginCandidate } from "@/src/lib/types";

// Perishables get a concrete use-by date so the Trust Arbiter's R4 (disclose the
// use-by date) has a real value to check, and the shopper sees when to use it.
// Shelf life scales loosely with how aggressive the clearance discount is.
function computeUseBy(sku: Sku): string {
  const days = (sku.expiryDiscountPct ?? 0) >= 0.25 ? 1 : 2;
  const d = new Date(DEMO_NOW);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ===========================================================================
// MARGIN AGENT — deterministic optimisation over catalog metadata, NOT an LLM.
//
// It reads the private columns (margin %, private-label pairs, expiry risk,
// stock) and proposes ranked retailer-side steers, each with:
//   - a structured internal reason + margin delta (Retailer Lens only), and
//   - a shopper-facing "why" that, by construction, contains NO margin numbers.
//
// It never decides what the shopper sees. Every candidate is only a *proposal*;
// the Trust Arbiter (deterministic, separate module) rules on each before any
// of it can reach the conversation. That separation is the safety story.
// ===========================================================================

const PRIVATE_LABEL_MARGIN_FLOOR = 0.28; // only pitch PL lines worth pitching
// Generous cap: the Margin agent should hand the arbiter *every* plausible steer
// and let policy (R1–R5) decide. Capping here would hide steers from the referee.
const MAX_CANDIDATES = 16;

export interface MarginOptions {
  focus?: "all" | "expiry"; // "expiry" powers the "swap expiring items" flow
}

/**
 * Produce ranked margin candidates for a basket. Pure/deterministic.
 * `basketSkuIds` is the shopper's current basket.
 */
export function getMarginCandidates(
  basketSkuIds: string[],
  opts: MarginOptions = {},
): MarginCandidate[] {
  const focus = opts.focus ?? "all";
  const basket = basketSkuIds.map(getSku).filter((s): s is Sku => !!s);
  const candidates: MarginCandidate[] = [];

  // --- 1. Expiry-clearance: perishables in the basket close to date. --------
  // Genuinely good for the shopper (discount) AND clears waste-risk stock.
  for (const item of basket) {
    if (item.expiryRisk && item.expiryDiscountPct) {
      const useBy = computeUseBy(item);
      candidates.push({
        id: `exp-${item.id}`,
        type: "expiry-clearance",
        toSkuId: item.id,
        useBy,
        whyShopper: `${Math.round(item.expiryDiscountPct * 100)}% off — fresh stock priced to clear, use by ${useBy}.`,
        marginReason: `Moves waste-risk perishable; avoids write-off on ${item.stock} units.`,
        marginDeltaPct: 0,
      });
    }
  }

  if (focus === "expiry") {
    return rankAndCap(candidates);
  }

  // --- 2. Private-label swaps: same-category PL alternatives. ----------------
  // The agent proposes *every* plausible PL swap above the margin floor — the
  // good (cheaper own-label) and the greedy (pricier own-label, allergy-tagged)
  // alike. It is intentionally NOT the agent's job to self-censor; that is the
  // arbiter's job, and surfacing the blocked ones is the whole demo.
  for (const item of basket) {
    if (item.privateLabel) continue; // already own-label
    const alternatives = CATALOG.filter(
      (s) =>
        s.id !== item.id &&
        s.privateLabel &&
        s.category === item.category &&
        s.marginPct >= PRIVATE_LABEL_MARGIN_FLOOR &&
        s.stock > 0 &&
        // Like-for-like only: the designated PL pair, or a shared product token.
        // Keeps the agent from pitching "atta → besan" just because they share a
        // catalog category. The arbiter still guards the ones that do qualify.
        (item.privateLabelPairId === s.id || sharesProductToken(item, s)),
    ).sort((a, b) => b.marginPct - a.marginPct);

    for (const alt of alternatives.slice(0, 2)) {
      const cheaper = alt.price <= item.price;
      candidates.push({
        id: `pl-${item.id}-${alt.id}`,
        type: "private-label-swap",
        fromSkuId: item.id,
        toSkuId: alt.id,
        whyShopper: cheaper
          ? `Same ${prettyCategory(item.category)}, our Apna Select label — ₹${item.price - alt.price} cheaper per pack.`
          : `Try our Apna Select ${prettyCategory(item.category)} — a premium own-label option.`,
        marginReason: `PL margin ${(alt.marginPct * 100).toFixed(0)}% vs ${(item.marginPct * 100).toFixed(0)}% on ${item.brand}.`,
        marginDeltaPct: alt.marginPct - item.marginPct,
      });
    }
  }

  // --- 3. Attach: one high-margin add-on the ranking likes. -----------------
  // Deliberately includes an allergy-tagged snack to prove the arbiter catches
  // attaches, not just swaps.
  const attach = CATALOG.filter(
    (s) => s.category === "snacks" && s.privateLabel && s.stock > 0,
  ).sort((a, b) => b.marginPct - a.marginPct)[0];
  if (attach && !basketSkuIds.includes(attach.id)) {
    candidates.push({
      id: `attach-${attach.id}`,
      type: "attach",
      toSkuId: attach.id,
      whyShopper: `Popular add-on this week — ${attach.name}.`,
      marginReason: `High-margin attach (${(attach.marginPct * 100).toFixed(0)}%).`,
      marginDeltaPct: attach.marginPct,
    });
  }

  return rankAndCap(candidates);
}

// Rank by internal margin attractiveness (delta + expiry urgency), cap the list.
function rankAndCap(candidates: MarginCandidate[]): MarginCandidate[] {
  return [...candidates]
    .sort((a, b) => marginScore(b) - marginScore(a))
    .slice(0, MAX_CANDIDATES);
}

function marginScore(c: MarginCandidate): number {
  if (c.type === "expiry-clearance") {
    const sku = getSku(c.toSkuId);
    return 0.3 + (sku?.expiryDiscountPct ?? 0); // waste-avoidance weighted high
  }
  return c.marginDeltaPct;
}

function prettyCategory(cat: string): string {
  return cat.replace(/-/g, " ");
}

// Two SKUs describe the "same product" if their names share a meaningful token
// (brand/marketing words stripped). Cheap, legible stand-in for a real product
// taxonomy — enough to keep swaps like-for-like.
const NAME_STOPWORDS = new Set([
  "apna", "select", "premium", "classic", "gold", "fresh", "pure", "the",
  "our", "whole", "and", "with", "rozana", "super",
]);
function tokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3 && !NAME_STOPWORDS.has(t)),
  );
}
function sharesProductToken(a: Sku, b: Sku): boolean {
  const ta = tokens(a.name);
  for (const t of tokens(b.name)) if (ta.has(t)) return true;
  return false;
}
