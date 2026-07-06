import type { ArbiterRuling, TraceEntry } from "@/src/lib/types";

// ===========================================================================
// INSIGHTS AGENT — stub.
//
// Retailer-facing. In production it would summarise, for a category manager,
// what the shopper agents learned this week: agent-attributed incremental
// margin, steer-acceptance rate, forecast accuracy, and merchandising nudges.
// Here it derives a tiny live digest from the current session's trace + rulings
// so the Retailer Lens has something honest to show.
// ===========================================================================

export interface InsightsDigest {
  steersProposed: number;
  steersApproved: number;
  steersBlocked: number;
  approvalRate: number; // 0..1
  agentsFired: string[];
  headline: string;
}

export function buildInsights(
  trace: TraceEntry[],
  rulings: ArbiterRuling[],
): InsightsDigest {
  const approved = rulings.filter((r) => r.decision === "approved").length;
  const blocked = rulings.filter((r) => r.decision === "blocked").length;
  const total = rulings.length;
  const agentsFired = [...new Set(trace.map((t) => t.agent))];
  return {
    steersProposed: total,
    steersApproved: approved,
    steersBlocked: blocked,
    approvalRate: total ? approved / total : 0,
    agentsFired,
    headline:
      blocked > 0
        ? `Trust Arbiter blocked ${blocked} of ${total} margin steers this session — safety guardrails holding.`
        : `${approved} shopper-safe steers surfaced this session.`,
  };
}
