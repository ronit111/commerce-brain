import type {
  ArbiterRuling,
  MarginCandidate,
  ModelTier,
  TraceEntry,
} from "@/src/lib/types";

// ===========================================================================
// RETAILER LENS — the two-sided thesis made visible.
//
// A dark "control room" drawer that exposes everything the shopper never sees:
// which agents fired, the Margin agent's ranked candidate steers WITH their
// internal margin numbers, and every Trust Arbiter ruling — approved, queued,
// and (the point of the whole demo) BLOCKED, each with the exact rule cited.
// ===========================================================================

const TIER_LABEL: Record<ModelTier, string> = {
  frontier: "LLM",
  slm: "SLM",
  deterministic: "DET",
};

const AGENT_TITLE: Record<string, string> = {
  concierge: "Concierge",
  discovery: "Discovery",
  "basket-builder": "Basket Builder",
  replenishment: "Replenishment",
  "budget-substitution": "Budget & Substitution",
  margin: "Margin",
  inventory: "Inventory",
  "trust-arbiter": "Trust Arbiter",
  checkout: "Checkout",
  insights: "Insights",
};

export interface LensState {
  trace: TraceEntry[];
  rulings: ArbiterRuling[];
}

export function RetailerLens({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: LensState | null;
}) {
  const trace = state?.trace ?? [];
  const rulings = state?.rulings ?? [];
  const marginEntry = trace.find((t) => t.agent === "margin");
  const candidates = (marginEntry?.data as MarginCandidate[] | undefined) ?? [];

  const approved = rulings.filter((r) => r.decision === "approved").length;
  const blocked = rulings.filter((r) => r.decision === "blocked").length;
  const queued = rulings.filter((r) => r.decision === "queued").length;
  const agentsFired = [...new Set(trace.map((t) => t.agent))];

  return (
    <>
      {/* scrim */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden
      />
      <aside
        className={`lens-scroll fixed right-0 top-0 z-40 flex h-full w-full max-w-[440px] flex-col overflow-y-auto transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--lens-bg)", color: "var(--lens-text)" }}
        aria-label="Retailer Lens"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b px-5 py-4" style={{ background: "var(--lens-bg)", borderColor: "var(--lens-line)" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded" style={{ background: "var(--lens-panel)" }}>
                <EyeIcon />
              </span>
              <h2 className="text-sm font-semibold tracking-tight">Retailer Lens</h2>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--lens-muted)" }}>
              The backstage the shopper never sees — margin agents and the referee that governs them.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
            style={{ background: "var(--lens-panel)", color: "var(--lens-muted)" }}
          >
            Close
          </button>
        </header>

        {trace.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <p className="text-sm leading-relaxed" style={{ color: "var(--lens-muted)" }}>
              Send a message — try <span style={{ color: "var(--lens-text)" }}>&ldquo;my usual weekly order&rdquo;</span> — and every agent that fires, every margin steer proposed, and every arbiter ruling appears here live.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-5 py-5">
            {/* tally */}
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Agents" value={agentsFired.length} />
              <Stat label="Approved" value={approved} tone="green" />
              <Stat label="Queued" value={queued} tone="amber" />
              <Stat label="Blocked" value={blocked} tone="red" />
            </div>

            {/* agents fired */}
            <Section title="Agents fired" subtitle="in order, with model tier">
              <ol className="flex flex-col gap-1.5">
                {trace.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2" style={{ background: "var(--lens-panel)" }}>
                    <TierBadge tier={t.tier} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        {AGENT_TITLE[t.agent] ?? t.agent} <span className="font-normal" style={{ color: "var(--lens-muted)" }}>· {t.action}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--lens-muted)" }}>{t.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            {/* margin candidates */}
            {candidates.length > 0 && (
              <Section title="Margin agent" subtitle="candidate steers, ranked — internal numbers, never shopper-visible">
                <ul className="flex flex-col gap-1.5">
                  {candidates.map((c) => (
                    <li key={c.id} className="rounded-lg px-3 py-2.5" style={{ background: "var(--lens-panel)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--lens-muted)" }}>{c.type.replace(/-/g, " ")}</span>
                        {c.marginDeltaPct > 0 && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style={{ background: "rgba(240,185,94,0.14)", color: "var(--lens-amber)" }}>
                            +{Math.round(c.marginDeltaPct * 100)} pts margin
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium">{steerLabel(c)}</p>
                      <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--lens-muted)" }}>{c.marginReason}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* arbiter rulings */}
            <Section title="Trust Arbiter" subtitle="deterministic policy — every steer ruled on, rule cited">
              <ul className="flex flex-col gap-2">
                {rulings.map((r) => (
                  <RulingCard key={r.candidateId} ruling={r} />
                ))}
              </ul>
              {blocked > 0 && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[11px] leading-snug" style={{ background: "rgba(242,133,122,0.10)", color: "var(--lens-red)" }}>
                  {blocked} margin steer{blocked > 1 ? "s were" : " was"} blocked before reaching the shopper. Safety is code here, not a prompt — this is the guardrail the CFO can audit.
                </p>
              )}
            </Section>
          </div>
        )}
      </aside>
    </>
  );
}

function steerLabel(c: MarginCandidate): string {
  if (c.type === "expiry-clearance") return `Discount ${skuShort(c.toSkuId)}`;
  if (c.fromSkuId) return `${skuShort(c.fromSkuId)} → ${skuShort(c.toSkuId)}`;
  return `Attach ${skuShort(c.toSkuId)}`;
}

// Cheap SKU-id → readable label without importing the whole catalog client-side.
function skuShort(id: string): string {
  return id
    .replace(/-\d+$/, "")
    .replace(/-dks-?/, " Apna Aisle ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function RulingCard({ ruling }: { ruling: ArbiterRuling }) {
  const tone =
    ruling.decision === "approved"
      ? { border: "var(--lens-green)", badge: "var(--lens-green)", bg: "rgba(78,203,150,0.06)", label: "APPROVED" }
      : ruling.decision === "blocked"
        ? { border: "var(--lens-red)", badge: "var(--lens-red)", bg: "rgba(242,133,122,0.08)", label: "BLOCKED" }
        : { border: "var(--lens-amber)", badge: "var(--lens-amber)", bg: "rgba(240,185,94,0.06)", label: "QUEUED" };

  return (
    <li
      className="rounded-lg border-l-2 px-3 py-2.5 dk-fade"
      style={{ borderColor: tone.border, background: tone.bg }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{ruling.steerSummary}</span>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide" style={{ color: tone.badge, background: "var(--lens-panel)" }}>
          {tone.label}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--lens-muted)" }}>
        <span className="font-medium" style={{ color: tone.badge }}>{ruling.blockedByRule ?? "passed R1–R5"}</span>
        {" — "}
        {ruling.reason}
      </p>
      {ruling.decision === "approved" && (
        <p className="mt-1.5 rounded px-2 py-1 text-[11px] italic" style={{ background: "var(--lens-panel)", color: "var(--lens-text)" }}>
          Shopper sees: “{ruling.whyShopper}”
        </p>
      )}
    </li>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        <p className="text-[11px]" style={{ color: "var(--lens-muted)" }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "red" }) {
  const color =
    tone === "green" ? "var(--lens-green)" : tone === "amber" ? "var(--lens-amber)" : tone === "red" ? "var(--lens-red)" : "var(--lens-text)";
  return (
    <div className="rounded-lg px-2 py-2.5 text-center" style={{ background: "var(--lens-panel)" }}>
      <p className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--lens-muted)" }}>{label}</p>
    </div>
  );
}

function TierBadge({ tier }: { tier: ModelTier }) {
  const color = tier === "deterministic" ? "var(--lens-green)" : tier === "slm" ? "var(--lens-amber)" : "var(--lens-text)";
  return (
    <span className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide" style={{ color, background: "rgba(255,255,255,0.04)" }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--lens-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
