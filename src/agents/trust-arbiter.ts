import { getSku } from "@/src/data/catalog";
import type { Household } from "@/src/data/types";
import type { ArbiterRuling, MarginCandidate } from "@/src/lib/types";

// ===========================================================================
// TRUST ARBITER — deterministic policy engine, NOT a prompt.
//
// This is the architectural claim of the whole system: retailer-side margin
// optimisation is only sustainable if it is *provably* shopper-safe. So the
// safety layer is ordinary, auditable code — never an LLM instruction that can
// be argued out of.
//
// It implements EXACTLY the five rules on deck slide 4, in that order:
//   R1  Dietary/allergy constraints are absolute.
//   R2  Never suppress a cheaper equivalent the shopper already chose.
//   R3  Every steer carries a shopper-visible "why".
//   R4  Expiry-risk steers must disclose the use-by date (and price it in).
//   R5  Per-household steer budget: max 2 flagged steers per draft basket;
//       the rest queue for next week.
//
// R1–R4 are per-candidate (arbitrate). R5 is a cross-candidate budget applied
// over a draft basket (arbitrateBasket). A soft trade-off SCORE is computed for
// transparency and shown in the Retailer Lens, but it never blocks — only the
// five rules do. Every ruling is logged with the exact rule cited.
// ===========================================================================

export const RULES = {
  R1_DIETARY_ALLERGY: "R1: dietary/allergy constraints are absolute",
  R2_SUPPRESS_CHEAPER: "R2: never suppress a cheaper equivalent already chosen",
  R3_MISSING_WHY: "R3: every steer must carry a shopper-visible 'why'",
  R4_EXPIRY_DISCLOSURE: "R4: expiry steers must disclose the use-by date",
  R5_STEER_BUDGET: "R5: max 2 flagged steers per draft basket",
} as const;

// The rules evaluated for a single candidate, in deck order (R5 is batch-level).
const PER_CANDIDATE_RULES = [
  RULES.R1_DIETARY_ALLERGY,
  RULES.R2_SUPPRESS_CHEAPER,
  RULES.R3_MISSING_WHY,
  RULES.R4_EXPIRY_DISCLOSURE,
];

export const STEER_BUDGET = 2; // R5

/**
 * Adjudicate a single margin candidate against rules R1–R4 for a household.
 * Pure function: same inputs → same ruling, no LLM, fully testable.
 * R5 (steer budget) is applied later, across the whole draft — see arbitrateBasket.
 */
export function arbitrate(
  candidate: MarginCandidate,
  household: Household,
): ArbiterRuling {
  const toSku = getSku(candidate.toSkuId);
  const fromSku = candidate.fromSkuId ? getSku(candidate.fromSkuId) : undefined;
  const toName = toSku?.name ?? candidate.toSkuId;
  const steerSummary =
    candidate.type === "expiry-clearance"
      ? `Discount ${toName}`
      : fromSku
        ? `Swap ${fromSku.name} → ${toName}`
        : `Attach ${toName}`;

  const score = toSku ? softScore(candidate, fromSku, toSku) : 0;
  const base = {
    candidateId: candidate.id,
    steerSummary,
    whyShopper: candidate.whyShopper,
    rulesChecked: PER_CANDIDATE_RULES,
    score,
  };
  const block = (rule: string, reason: string): ArbiterRuling => ({
    ...base,
    decision: "blocked",
    blockedByRule: rule,
    reason,
  });

  if (!toSku) {
    return block(RULES.R1_DIETARY_ALLERGY, `Target SKU ${candidate.toSkuId} not found.`);
  }

  // --- R1: dietary / allergy is a hard wall. -------------------------------
  // The target must carry no tag the household is allergic to, and must satisfy
  // every dietary preference the household shops by (e.g. veg-only).
  const allergyHit = toSku.dietaryTags.find((t) => household.allergies.includes(t));
  if (allergyHit) {
    return block(
      RULES.R1_DIETARY_ALLERGY,
      `${toSku.name} is tagged "${allergyHit}"; household has a ${allergyHit.replace("contains-", "")} allergy.`,
    );
  }
  if (household.dietaryPrefs.includes("veg") && toSku.dietaryTags.includes("non-veg")) {
    return block(RULES.R1_DIETARY_ALLERGY, `${toSku.name} is non-veg; household shops vegetarian.`);
  }

  // --- R2: don't steer away from a cheaper equivalent already chosen. -------
  // Moving the shopper OFF a SKU they deliberately picked is only allowed if the
  // new item is not more expensive. Higher margin is fine; making them pay more
  // to get it is not.
  if (fromSku && household.deliberatelyChosen.includes(fromSku.id) && toSku.price > fromSku.price) {
    return block(
      RULES.R2_SUPPRESS_CHEAPER,
      `${fromSku.name} (₹${fromSku.price}) was a deliberate choice and is cheaper than ${toSku.name} (₹${toSku.price}).`,
    );
  }

  // --- R3: a steer with no shopper-facing reason is never allowed. ---------
  if (!candidate.whyShopper || candidate.whyShopper.trim().length === 0) {
    return block(RULES.R3_MISSING_WHY, "Steer carried no 'why' for the shopper.");
  }

  // --- R4: expiry steers must disclose the use-by date. --------------------
  // A discount that hides how little time is left is a trap, not a saving.
  if (candidate.type === "expiry-clearance") {
    const discloses =
      !!candidate.useBy && candidate.whyShopper.toLowerCase().includes("use by");
    if (!discloses) {
      return block(
        RULES.R4_EXPIRY_DISCLOSURE,
        "Expiry steer did not disclose a use-by date to the shopper.",
      );
    }
  }

  // Cleared R1–R4. R5 (steer budget) is decided across the whole draft.
  return {
    ...base,
    decision: "approved",
    reason:
      candidate.type === "expiry-clearance"
        ? `Discounted and dated (use by ${candidate.useBy}); shopper saves money, no constraint touched.`
        : "Genuinely equivalent, same-or-lower price, constraint-safe.",
  };
}

/**
 * Arbitrate every candidate in a draft basket, then enforce R5: at most
 * STEER_BUDGET approved steers reach the shopper; further approvals are marked
 * "queued" (safe, but deferred to next week). The most shopper-valuable steers
 * — by soft score — win the budget. Rulings keep the input order for the lens.
 */
export function arbitrateBasket(
  candidates: MarginCandidate[],
  household: Household,
): { rulings: ArbiterRuling[]; surfaced: MarginCandidate[] } {
  const rulings = candidates.map((c) => arbitrate(c, household));
  const byId = new Map(candidates.map((c) => [c.id, c]));

  // R5: at most STEER_BUDGET approved steers reach the shopper. Selection is
  // shopper-value-first (soft score) but type-diverse: we'd rather show one good
  // saving of each kind (a cheaper own-label swap AND an expiry discount) than
  // two of the same. The rest queue for next week.
  const approvedRulings = rulings
    .filter((r) => r.decision === "approved")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const keep = new Set<string>();
  const seenTypes = new Set<string>();
  for (const r of approvedRulings) {
    if (keep.size >= STEER_BUDGET) break;
    const type = byId.get(r.candidateId)?.type;
    if (type && !seenTypes.has(type)) {
      keep.add(r.candidateId);
      seenTypes.add(type);
    }
  }
  for (const r of approvedRulings) {
    if (keep.size >= STEER_BUDGET) break;
    keep.add(r.candidateId);
  }

  for (const r of rulings) {
    if (r.decision === "approved" && !keep.has(r.candidateId)) {
      r.decision = "queued";
      r.blockedByRule = RULES.R5_STEER_BUDGET;
      r.reason = `Steer budget of ${STEER_BUDGET} reached — safe, but queued for next week's draft.`;
    }
  }
  if (approvedRulings.length > 0) {
    for (const r of rulings) r.rulesChecked = [...PER_CANDIDATE_RULES, RULES.R5_STEER_BUDGET];
  }

  const surfaced = rulings
    .filter((r) => r.decision === "approved")
    .map((r) => byId.get(r.candidateId))
    .filter((c): c is MarginCandidate => !!c);

  return { rulings, surfaced };
}

// Soft trade-off score in [0,1] — TRANSPARENCY ONLY, never blocks. Positive
// signals: cheaper for the shopper, a real expiry discount, equivalent category.
// Negative: a pricier or off-category switch the shopper didn't ask for. Kept
// legible on purpose; it's how the Retailer Lens ranks steers, not a black box.
function softScore(
  candidate: MarginCandidate,
  fromSku: ReturnType<typeof getSku>,
  toSku: NonNullable<ReturnType<typeof getSku>>,
): number {
  let score = 0.5;
  if (candidate.type === "expiry-clearance") {
    score += Math.min((toSku.expiryDiscountPct ?? 0) * 2, 0.4); // a 20% discount is a strong positive
  }
  if (fromSku) {
    if (toSku.price < fromSku.price) score += 0.2; // cheaper for the shopper
    if (toSku.price > fromSku.price) score -= 0.3; // pricier — suspicious
    if (toSku.category !== fromSku.category) score -= 0.3; // not equivalent
  }
  return Math.max(0, Math.min(1, score));
}
