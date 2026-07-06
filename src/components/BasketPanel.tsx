import type { Basket } from "@/src/lib/types";

// Live basket panel — items, qty, line totals, basket total, and accumulated
// savings. This is the shopper-facing ledger; it never shows margin or any
// retailer economics. Those live only in the Retailer Lens.

export function BasketPanel({ basket, checkout }: { basket: Basket; checkout: CheckoutInfo | null }) {
  const empty = basket.items.length === 0;
  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-[var(--dk-paper)]" style={{ borderColor: "var(--dk-line)" }}>
      <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--dk-line)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--dk-ink)" }}>Your basket</h2>
          <p className="text-xs" style={{ color: "var(--dk-muted)" }}>
            {empty ? "Nothing yet" : `${basket.items.length} item${basket.items.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--dk-green-soft)" }} aria-hidden>
          <BagIcon />
        </div>
      </header>

      <div className="dk-scroll flex-1 overflow-y-auto px-2 py-2">
        {empty ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="text-sm leading-relaxed" style={{ color: "var(--dk-muted)" }}>
              Ask the concierge to build your usual order, plan a meal, or find honest savings — the basket fills here in real time.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {basket.items.map((it) => (
              <li key={it.skuId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--dk-cream)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-semibold" style={{ background: "var(--dk-green-soft)", color: "var(--dk-green-dark)" }}>
                  {it.qty}×
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium leading-tight" style={{ color: "var(--dk-ink)" }}>{it.name}</p>
                  <p className="truncate text-[11px]" style={{ color: "var(--dk-muted)" }}>
                    {it.brand} · ₹{it.price}/pack
                  </p>
                </div>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--dk-ink)" }}>₹{it.lineTotal}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t px-5 py-4" style={{ borderColor: "var(--dk-line)" }}>
        {basket.savings > 0 && (
          <div className="mb-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "var(--dk-amber-soft)", color: "var(--dk-amber)" }}>
            <span>You saved</span>
            <span className="tabular-nums">₹{basket.savings}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm" style={{ color: "var(--dk-muted)" }}>Total</span>
          <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--dk-ink)" }}>₹{basket.total}</span>
        </div>
        {checkout ? (
          <div className="mt-3 rounded-xl border px-3 py-3 text-xs dk-fade" style={{ borderColor: "var(--dk-green)", background: "var(--dk-green-soft)" }}>
            <p className="font-semibold" style={{ color: "var(--dk-green-dark)" }}>✓ UPI mandate confirmed</p>
            <p className="mt-0.5" style={{ color: "var(--dk-muted)" }}>
              Order {checkout.orderId} · slot {checkout.slot}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--dk-muted)" }}>
              Payment rails simulated for the demo
            </p>
          </div>
        ) : null}
      </footer>
    </aside>
  );
}

export interface CheckoutInfo {
  orderId: string;
  slot: string;
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dk-green-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
