import { describe, it, expect } from "vitest";
import { arbitrate, arbitrateBasket, RULES, STEER_BUDGET } from "@/src/agents/trust-arbiter";
import { getMarginCandidates } from "@/src/agents/margin";
import { draftReplenishment } from "@/src/agents/replenishment";
import { HOUSEHOLD } from "@/src/data/household";
import type { Household } from "@/src/data/types";
import type { MarginCandidate } from "@/src/lib/types";

// A minimal household fixture; overridden per-test where a rule needs a specific
// allergy / preference / deliberate-choice setup.
function household(over: Partial<Household> = {}): Household {
  return {
    id: "hh-test",
    label: "Test",
    city: "Bengaluru",
    size: 3,
    monthlyBudget: 10000,
    dietaryPrefs: ["veg"],
    allergies: ["contains-peanut"],
    deliberatelyChosen: ["oil-fortune-1"],
    history: [],
    ...over,
  };
}

function candidate(over: Partial<MarginCandidate> & Pick<MarginCandidate, "id" | "type" | "toSkuId">): MarginCandidate {
  return {
    whyShopper: "why",
    marginReason: "reason",
    marginDeltaPct: 0.2,
    ...over,
  };
}

describe("Trust Arbiter — one test per rule", () => {
  it("R1: blocks a steer to a SKU carrying an allergen the household reacts to", () => {
    const r = arbitrate(
      candidate({ id: "c", type: "attach", toSkuId: "pb-dks-340", whyShopper: "Popular add-on." }),
      household(),
    );
    expect(r.decision).toBe("blocked");
    expect(r.blockedByRule).toBe(RULES.R1_DIETARY_ALLERGY);
  });

  it("R1: also blocks a steer that violates a dietary preference (veg → non-veg)", () => {
    const r = arbitrate(
      candidate({ id: "c", type: "attach", toSkuId: "eggs-6", whyShopper: "Add eggs." }),
      household(),
    );
    expect(r.decision).toBe("blocked");
    expect(r.blockedByRule).toBe(RULES.R1_DIETARY_ALLERGY);
  });

  it("R2: blocks steering off a cheaper item the shopper deliberately chose to a pricier one", () => {
    const r = arbitrate(
      candidate({
        id: "c",
        type: "private-label-swap",
        fromSkuId: "oil-fortune-1", // ₹140, deliberately chosen
        toSkuId: "oil-dks-sunflower-1", // ₹175, higher margin
        whyShopper: "Try our premium own-label oil.",
      }),
      household(),
    );
    expect(r.decision).toBe("blocked");
    expect(r.blockedByRule).toBe(RULES.R2_SUPPRESS_CHEAPER);
  });

  it("R2: allows the same swap direction when the new item is NOT more expensive", () => {
    // Aashirvaad atta (₹330) → Apna Select atta (₹299): cheaper, so R2 permits it.
    const r = arbitrate(
      candidate({
        id: "c",
        type: "private-label-swap",
        fromSkuId: "atta-aashirvaad-5",
        toSkuId: "atta-dks-5",
        whyShopper: "Same atta, ₹31 cheaper per pack.",
      }),
      household({ deliberatelyChosen: ["atta-aashirvaad-5"] }),
    );
    expect(r.decision).toBe("approved");
  });

  it("R3: blocks a steer that carries no shopper-facing 'why'", () => {
    const r = arbitrate(
      candidate({
        id: "c",
        type: "private-label-swap",
        fromSkuId: "atta-aashirvaad-5",
        toSkuId: "atta-dks-5",
        whyShopper: "   ", // blank
      }),
      household(),
    );
    expect(r.decision).toBe("blocked");
    expect(r.blockedByRule).toBe(RULES.R3_MISSING_WHY);
  });

  it("R4: blocks an expiry steer that hides the use-by date", () => {
    const r = arbitrate(
      candidate({
        id: "c",
        type: "expiry-clearance",
        toSkuId: "tomato-1",
        whyShopper: "25% off — grab it cheap.", // no use-by disclosed
        useBy: undefined,
      }),
      household(),
    );
    expect(r.decision).toBe("blocked");
    expect(r.blockedByRule).toBe(RULES.R4_EXPIRY_DISCLOSURE);
  });

  it("R4: approves an expiry steer that discloses the use-by date", () => {
    const r = arbitrate(
      candidate({
        id: "c",
        type: "expiry-clearance",
        toSkuId: "tomato-1",
        useBy: "Tue, 7 Jul",
        whyShopper: "25% off — fresh stock priced to clear, use by Tue, 7 Jul.",
      }),
      household(),
    );
    expect(r.decision).toBe("approved");
  });

  it("R5: caps surfaced steers at the budget; the rest are queued (safe, deferred)", () => {
    const clean: MarginCandidate[] = ["tomato-1", "banana-1", "spinach-1", "coriander-100"].map((id, i) =>
      candidate({
        id: `exp-${i}`,
        type: "expiry-clearance",
        toSkuId: id,
        useBy: "Tue, 7 Jul",
        whyShopper: "20% off — priced to clear, use by Tue, 7 Jul.",
      }),
    );
    const { rulings } = arbitrateBasket(clean, household());
    const approved = rulings.filter((r) => r.decision === "approved");
    const queued = rulings.filter((r) => r.decision === "queued");
    expect(approved.length).toBe(STEER_BUDGET);
    expect(queued.length).toBe(clean.length - STEER_BUDGET);
    expect(queued.every((r) => r.blockedByRule === RULES.R5_STEER_BUDGET)).toBe(true);
  });
});

describe("Deck slide 4 — the three named rulings on the real household", () => {
  // Drive the actual pipeline: usual-order basket → margin candidates → arbiter.
  const basketIds = draftReplenishment(HOUSEHOLD).map((d) => d.skuId);
  const candidates = getMarginCandidates(basketIds, { focus: "all" });
  const { rulings } = arbitrateBasket(candidates, HOUSEHOLD);

  it("BLOCKED — the peanut-butter attach, on rule 1 (allergy)", () => {
    const pb = rulings.find((r) => r.steerSummary.toLowerCase().includes("peanut butter"));
    expect(pb).toBeDefined();
    expect(pb!.decision).toBe("blocked");
    expect(pb!.blockedByRule).toBe(RULES.R1_DIETARY_ALLERGY);
  });

  it("BLOCKED — the pricier refined-oil swap, on rule 2 (cheaper choice preserved)", () => {
    const oil = rulings.find(
      (r) => /fortune/i.test(r.reason) && r.blockedByRule === RULES.R2_SUPPRESS_CHEAPER,
    );
    expect(oil).toBeDefined();
    expect(oil!.decision).toBe("blocked");
  });

  it("APPROVED — the Apna Select atta swap (cheaper, equivalent, passes R1–R5)", () => {
    const atta = rulings.find(
      (r) => r.steerSummary.toLowerCase().includes("atta") && r.decision === "approved",
    );
    expect(atta).toBeDefined();
    expect(atta!.blockedByRule).toBeUndefined();
    expect(atta!.whyShopper).toMatch(/cheaper/i);
  });
});
