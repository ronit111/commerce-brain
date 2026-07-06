import type { Household, PastOrder } from "./types";

// ---------------------------------------------------------------------------
// One mock household — the Sharma family, 3 people, Bengaluru — with ~8 weeks
// of weekly orders. The history is generated from explicit per-SKU cadences so
// the deterministic Replenishment model (median days-between-purchases) has real
// signal to work with. See src/agents/replenishment.ts.
//
// Deliberately built to exercise the Trust Arbiter:
//   - allergy: peanut  -> any peanut SKU steer must be BLOCKED
//   - deliberatelyChosen: Fortune oil (cheap) -> a pricier "equivalent" steer
//     must be BLOCKED as suppressing a cheaper choice the shopper already made.
// ---------------------------------------------------------------------------

// The 8 weekly order dates, most recent last. Today (demo clock) is 2026-07-06,
// so the last order was 8 days ago and the weekly staples read as "due".
const ORDER_DATES = [
  "2026-05-10",
  "2026-05-17",
  "2026-05-24",
  "2026-05-31",
  "2026-06-07",
  "2026-06-14",
  "2026-06-21",
  "2026-06-28",
];

// Per-SKU cadence: which of the 8 weeks (0-indexed) the family bought it, and qty.
// Weekly items appear in every week; staples every 2–4 weeks. `salt` appears once
// on purpose — the model can't infer an interval from a single buy and must skip it.
const CADENCE: Array<{ skuId: string; weeks: number[]; qty: number }> = [
  // Weekly perishables & essentials
  { skuId: "milk-amul-1", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 4 },
  { skuId: "onion-1", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 1 },
  { skuId: "tomato-1", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 1 },
  { skuId: "potato-1", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 1 },
  { skuId: "banana-1", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 1 },
  { skuId: "paneer-dks-200", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 2 },
  { skuId: "coriander-100", weeks: [0, 1, 2, 3, 4, 5, 6, 7], qty: 1 },
  { skuId: "spinach-1", weeks: [1, 3, 5, 7], qty: 1 },
  // Fortnightly staples
  { skuId: "toor-dks-1", weeks: [1, 3, 5], qty: 1 },
  { skuId: "curd-nandini-500", weeks: [0, 2, 4, 6], qty: 2 },
  { skuId: "oats-dks-1", weeks: [0, 2, 4, 6], qty: 1 },
  { skuId: "sugar-dks-1", weeks: [1, 5], qty: 1 },
  // Every ~3 weeks. The family buys the *national-brand* Aashirvaad atta — so the
  // Margin agent will pitch the cheaper Apna Select own-label (a clean,
  // arbiter-APPROVED steer), while the pricier own-label oils get BLOCKED.
  { skuId: "atta-aashirvaad-5", weeks: [0, 2, 5], qty: 1 },
  { skuId: "oil-fortune-1", weeks: [2, 5], qty: 1 },
  // Every ~4 weeks
  { skuId: "rice-dks-5", weeks: [0, 4], qty: 1 },
  { skuId: "tea-dks-500", weeks: [0, 4], qty: 1 },
  // One-off — model should NOT draft this (no inferable interval)
  { skuId: "salt-tata-1", weeks: [0], qty: 1 },
];

function buildHistory(): PastOrder[] {
  return ORDER_DATES.map((date, week) => ({
    date,
    lines: CADENCE.filter((c) => c.weeks.includes(week)).map((c) => ({
      skuId: c.skuId,
      qty: c.qty,
    })),
  }));
}

export const HOUSEHOLD: Household = {
  id: "hh-sharma-blr",
  label: "Sharma family",
  city: "Bengaluru",
  size: 3,
  monthlyBudget: 12000,
  dietaryPrefs: ["veg"],
  allergies: ["contains-peanut"],
  deliberatelyChosen: ["oil-fortune-1", "toor-dks-1", "paneer-dks-200"],
  history: buildHistory(),
};

// The demo's "now". Kept as a constant so replenishment is deterministic and
// reproducible regardless of the wall clock when the demo is run.
export const DEMO_NOW = "2026-07-06";
