import { newSession, runTurn, type Session } from "@/src/agents/orchestrator";
import { draftReplenishment } from "@/src/agents/replenishment";
import { HOUSEHOLD } from "@/src/data/household";
import { getSku } from "@/src/data/catalog";
import type {
  ArbiterRuling,
  MarginCandidate,
  TraceEntry,
  TurnResult,
} from "@/src/lib/types";

// ===========================================================================
// demo:trace — headless golden-path runner.
//
// Runs the three canned demo prompts through the SAME orchestrator the web app
// uses (mock mode, no API key), and prints the full end-to-end agent trace as
// plain text: intent, replenishment intervals, margin candidates + scores, and
// every Trust Arbiter ruling with the exact rule and shopper-facing why-string.
//
// This is the deck's slide-6 trace, made watchable in a terminal. It is also
// the fastest way to confirm the two thesis BLOCKs and the clean APPROVE still
// land after any change to the data or the agents.
// ===========================================================================

const R = "\x1b[0m";
const B = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function rule(char = "─", n = 74): string {
  return char.repeat(n);
}
function heading(title: string): void {
  console.log("\n" + B + CYAN + rule("═") + R);
  console.log(B + CYAN + "  " + title + R);
  console.log(B + CYAN + rule("═") + R);
}
function sub(title: string): void {
  console.log("\n" + B + title + R + "\n" + DIM + rule() + R);
}

function tierTag(tier: string): string {
  const map: Record<string, string> = {
    frontier: "LLM ",
    slm: "SLM ",
    deterministic: "DET ",
  };
  return DIM + "[" + (map[tier] ?? tier) + "]" + R;
}

function decisionTag(d: ArbiterRuling["decision"]): string {
  if (d === "approved") return GREEN + B + "APPROVED" + R;
  if (d === "blocked") return RED + B + "BLOCKED " + R;
  return YELLOW + B + "QUEUED  " + R;
}

function renderTrace(trace: TraceEntry[]): void {
  sub("Agent trace (in fire order)");
  for (const e of trace) {
    console.log(
      `${tierTag(e.tier)} ${B}${e.agent.padEnd(20)}${R} ${e.action}`,
    );
    console.log(`      ${DIM}${e.detail}${R}`);
  }
}

function renderReplenishment(): void {
  // Pull the deterministic model directly so per-SKU intervals are explicit.
  const due = draftReplenishment(HOUSEHOLD);
  sub("Replenishment model — per-SKU learned cadence (deterministic, no LLM)");
  console.log(
    DIM +
      "  qty  item".padEnd(46) +
      "interval   last buy    verdict" +
      R,
  );
  for (const d of due) {
    console.log(
      `  ${String(d.qty).padStart(2)}×  ${d.name.slice(0, 34).padEnd(36)}` +
        `~${String(d.intervalDays).padStart(2)}d      ${String(d.daysSinceLast).padStart(2)}d ago    ` +
        GREEN +
        "DUE" +
        R,
    );
  }
  console.log(
    DIM +
      "  (single-purchase SKUs like Tata Salt are skipped: no inferable interval)" +
      R,
  );
}

function renderMarginAndRulings(trace: TraceEntry[], rulings: ArbiterRuling[]): void {
  const marginEntry = trace.find((t) => t.agent === "margin");
  const candidates = (marginEntry?.data as MarginCandidate[] | undefined) ?? [];
  if (candidates.length > 0) {
    sub("Margin agent — candidate steers proposed (retailer-lens only)");
    for (const c of candidates) {
      const to = getSku(c.toSkuId);
      const from = c.fromSkuId ? getSku(c.fromSkuId) : undefined;
      const label = from ? `${from.name} → ${to?.name}` : to?.name ?? c.toSkuId;
      console.log(
        `  ${DIM}${c.type.padEnd(20)}${R} ${label}`,
      );
      console.log(
        `      ${DIM}margin: ${c.marginReason} (Δ ${(c.marginDeltaPct * 100).toFixed(0)} pts)${R}`,
      );
    }
  }

  if (rulings.length === 0) {
    console.log("\n" + DIM + "  (no retailer-side steers on this path)" + R);
    return;
  }
  sub("Trust Arbiter — ruling on every steer (deterministic policy engine)");
  for (const r of rulings) {
    const scorePart =
      r.score !== undefined ? DIM + ` score ${r.score.toFixed(2)}` + R : "";
    console.log(`  ${decisionTag(r.decision)}  ${B}${r.steerSummary}${R}${scorePart}`);
    console.log(`            ${DIM}rule:${R} ${r.blockedByRule ?? "passed R1–R5"}`);
    console.log(`            ${DIM}why :${R} ${r.reason}`);
    if (r.decision === "approved") {
      console.log(`            ${DIM}shopper sees:${R} "${r.whyShopper}"`);
    }
  }
}

async function runPath(session: Session, label: string, message: string): Promise<TurnResult> {
  heading(label);
  console.log(`${DIM}shopper says:${R} ${B}"${message}"${R}`);
  const res = await runTurn(session, message, { mock: true });
  console.log(`\n${DIM}intent classified:${R} ${B}${res.intent}${R} ${DIM}(SLM tier)${R}`);
  if (message.toLowerCase().includes("usual")) renderReplenishment();
  renderTrace(res.trace);
  renderMarginAndRulings(res.trace, res.rulings);
  sub("Composed Concierge reply (frontier LLM voice)");
  console.log(res.reply.split("\n").map((l) => "  " + l).join("\n"));
  sub("Final basket");
  console.log(
    `  ${res.basket.items.length} lines · total ${B}₹${res.basket.total}${R}` +
      (res.basket.savings > 0 ? ` · saved ${GREEN}₹${res.basket.savings}${R}` : ""),
  );
  return res;
}

async function main(): Promise<void> {
  console.log(
    B + "\nCommerce Brain — golden-path trace (mock mode, no API key)" + R,
  );
  console.log(DIM + "Apna Aisle · household: " + HOUSEHOLD.label + " (" + HOUSEHOLD.city + ")" + R);
  console.log(
    DIM +
      "allergies: " +
      HOUSEHOLD.allergies.join(", ") +
      " · deliberate choices: " +
      HOUSEHOLD.deliberatelyChosen.join(", ") +
      R,
  );

  const p1 = await runPath(newSession("trace-1"), "PATH 1 — Plan a meal to a budget", "Plan dinner for 4 under Rs 800, veg");
  const p2 = await runPath(newSession("trace-2"), "PATH 2 — The usual weekly order (the two-sided proof)", "My usual weekly order");
  const p3 = await runPath(newSession("trace-3"), "PATH 3 — Swap expiring items for discounts", "Swap anything expiring soon for discounts");

  // Assertion summary: the three thesis rulings from deck slide 4 must appear.
  heading("THESIS CHECK — the three slide-4 rulings");
  const allRulings = [...p1.rulings, ...p2.rulings, ...p3.rulings];
  const pbBlock = allRulings.find(
    (r) => r.decision === "blocked" && /peanut/i.test(r.reason) && r.blockedByRule?.startsWith("R1"),
  );
  const oilBlock = allRulings.find(
    (r) => r.decision === "blocked" && /fortune/i.test(r.reason) && r.blockedByRule?.startsWith("R2"),
  );
  const attaApprove = p2.rulings.find(
    (r) => r.decision === "approved" && /atta/i.test(r.steerSummary),
  );
  const line = (ok: boolean, label: string, detail?: string) =>
    console.log(`  ${ok ? GREEN + "✓" + R : RED + "✗" + R} ${label}${detail ? DIM + " — " + detail + R : ""}`);
  line(!!pbBlock, "Rule 1 BLOCK — peanut product steered at an allergic household", pbBlock?.steerSummary);
  line(!!oilBlock, "Rule 2 BLOCK — cheaper previously-chosen oil not suppressed", oilBlock?.steerSummary);
  line(!!attaApprove, "APPROVE — Apna Select atta, cheaper & equivalent", attaApprove?.steerSummary);

  const pass = !!pbBlock && !!oilBlock && !!attaApprove;
  console.log(
    "\n  " +
      (pass ? GREEN + B + "ALL THREE THESIS RULINGS PRESENT." : RED + B + "THESIS RULINGS MISSING — build regressed.") +
      R +
      "\n",
  );
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
