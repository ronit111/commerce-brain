import { getSku } from "@/src/data/catalog";
import type { Household } from "@/src/data/types";
import { DEMO_NOW } from "@/src/data/household";

// ===========================================================================
// REPLENISHMENT — deterministic consumption model, NOT an LLM.
//
// Thesis point: *no LLM invents a forecast.* Predicting when a household runs
// out of atta is a time-series problem, so it's solved with arithmetic over the
// order history. The LLM's only job (elsewhere) is to explain the draft and
// negotiate edits in language. That division — ML predicts, LLM converses — is
// what keeps the autopilot both cheap and trustworthy.
//
// Model: for each SKU, take the median gap (in days) between past purchases.
// If today is at least DUE_RATIO × that median since the last buy, it's due.
// SKUs bought only once have no inferable interval and are deliberately skipped.
// ===========================================================================

const DUE_RATIO = 0.85; // draft slightly ahead of the predicted run-out
const MS_PER_DAY = 86_400_000;

export interface DueItem {
  skuId: string;
  name: string;
  qty: number; // typical quantity (median of past order quantities)
  intervalDays: number; // learned median cadence
  daysSinceLast: number;
  reason: string; // human-readable, e.g. "bought every ~7 days, last 8 days ago"
}

interface Stat {
  qtys: number[];
  dates: number[]; // epoch ms, ascending
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Draft the replenishment basket for a household as of `now` (defaults to the
 * demo clock). Pure and deterministic.
 */
export function draftReplenishment(
  household: Household,
  now: string = DEMO_NOW,
): DueItem[] {
  const nowMs = new Date(now).getTime();

  // 1. Aggregate purchase dates + quantities per SKU from the order history.
  const stats = new Map<string, Stat>();
  for (const order of household.history) {
    const t = new Date(order.date).getTime();
    for (const line of order.lines) {
      const s = stats.get(line.skuId) ?? { qtys: [], dates: [] };
      s.qtys.push(line.qty);
      s.dates.push(t);
      stats.set(line.skuId, s);
    }
  }

  const due: DueItem[] = [];
  for (const [skuId, s] of stats) {
    // Need at least two purchases to infer an interval — otherwise skip.
    if (s.dates.length < 2) continue;

    const sorted = [...s.dates].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i] - sorted[i - 1]) / MS_PER_DAY);
    }
    const intervalDays = Math.round(median(gaps));
    if (intervalDays <= 0) continue;

    const lastMs = sorted[sorted.length - 1];
    const daysSinceLast = Math.round((nowMs - lastMs) / MS_PER_DAY);

    if (daysSinceLast >= intervalDays * DUE_RATIO) {
      const sku = getSku(skuId);
      if (!sku) continue;
      due.push({
        skuId,
        name: sku.name,
        qty: Math.round(median(s.qtys)) || 1,
        intervalDays,
        daysSinceLast,
        reason: `bought every ~${intervalDays} days, last ${daysSinceLast} days ago`,
      });
    }
  }

  // Most-overdue first — the shopper reviews the urgent stuff at the top.
  due.sort(
    (a, b) => b.daysSinceLast / b.intervalDays - a.daysSinceLast / a.intervalDays,
  );
  return due;
}
