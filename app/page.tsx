"use client";

import { useEffect, useRef, useState } from "react";
import { ChatPanel, type ChatMsg } from "@/src/components/ChatPanel";
import { BasketPanel, type CheckoutInfo } from "@/src/components/BasketPanel";
import { RetailerLens, type LensState } from "@/src/components/RetailerLens";
import { BrandMark, BrandWord } from "@/src/components/Brand";
import type { Basket, TurnResult } from "@/src/lib/types";

const EMPTY_BASKET: Basket = { items: [], total: 0, savings: 0 };

let msgSeq = 0;
const nextId = () => `m${++msgSeq}`;

export default function Home() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: nextId(),
      role: "concierge",
      text:
        "Hi! I'm your Apna Aisle concierge. I can build your usual weekly order in one tap, plan a meal to a budget, or find honest savings on what's expiring. Try a shortcut below — and open the Retailer Lens to watch every agent work.",
    },
  ]);
  const [basket, setBasket] = useState<Basket>(EMPTY_BASKET);
  const [lens, setLens] = useState<LensState | null>(null);
  const [lensOpen, setLensOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"mock" | "live" | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const sessionId = useRef<string>(`sess-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => setMode("mock"));
  }, []);

  function applyResult(result: TurnResult) {
    setBasket(result.basket);
    setLens({ trace: result.trace, rulings: result.rulings });
    setCheckout(null);
    const steers = result.rulings
      .filter((r) => r.decision === "approved")
      .map((r) => ({ summary: r.steerSummary, why: r.whyShopper }));
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "concierge", text: result.reply, steers: steers.length ? steers : undefined },
    ]);
  }

  async function send(message: string) {
    if (busy) return;
    setBusy(true);
    setMessages((prev) => [...prev, { id: nextId(), role: "shopper", text: message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      applyResult(data as TurnResult);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "concierge", text: `Sorry — ${err instanceof Error ? err.message : "something went wrong"}.` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function replenish() {
    if (busy) return;
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "system", text: "Sunday, 6:00 PM · agent-initiated draft" },
    ]);
    try {
      const res = await fetch("/api/replenish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      applyResult(data as TurnResult);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "concierge", text: `Sorry — ${err instanceof Error ? err.message : "draft failed"}.` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    // Simulated agentic checkout — a fake UPI Autopay mandate. No real rails.
    setCheckout({
      orderId: `AA-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      slot: "Today, 7–9 PM",
    });
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "shopper", text: "Approve" },
      {
        id: nextId(),
        role: "concierge",
        text: `Done — UPI Autopay mandate confirmed and your slot is booked for today, 7–9 PM. I'll draft next week's basket on Sunday. (Payment is simulated in this demo.)`,
      },
    ]);
  }

  const blockedCount = lens?.rulings.filter((r) => r.decision === "blocked").length ?? 0;

  return (
    <div className="flex h-full min-h-full flex-1 flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--dk-line)", background: "var(--dk-paper)" }}>
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <div className="leading-none">
            <p className="text-[15px]"><BrandWord /></p>
            <p className="text-[10px] tracking-wide" style={{ color: "var(--dk-muted)" }}>
              powered by <span className="font-medium" style={{ color: "var(--dk-green)" }}>Commerce Brain</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {mode && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
              style={mode === "live" ? { background: "var(--dk-green-soft)", color: "var(--dk-green-dark)" } : { background: "var(--dk-amber-soft)", color: "var(--dk-amber)" }}
              title={mode === "live" ? "Concierge language is a live model call" : "Deterministic agents run for real; concierge language is scripted"}
            >
              {mode === "live" ? "Live model" : "Mock model"}
            </span>
          )}
          <button
            onClick={() => setLensOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={lensOpen ? { background: "var(--dk-ink)", color: "#fff" } : { background: "var(--lens-bg)", color: "#fff" }}
          >
            <LensGlyph />
            {lensOpen ? "Hide" : "Retailer Lens"}
            {!lensOpen && blockedCount > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold" style={{ background: "var(--lens-red)", color: "#3a0f0c" }}>
                {blockedCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* body */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 gap-4 overflow-hidden p-4">
        <section className="flex min-h-0 w-full max-w-[440px] flex-1 flex-col">
          <ChatPanel
            messages={messages}
            busy={busy}
            onSend={send}
            onReplenish={replenish}
            onApprove={approve}
            canApprove={basket.items.length > 0 && !checkout}
          />
        </section>
        <section className="hidden min-h-0 w-[320px] shrink-0 md:flex">
          <BasketPanel basket={basket} checkout={checkout} />
        </section>
      </main>

      <RetailerLens open={lensOpen} onClose={() => setLensOpen(false)} state={lens} />
    </div>
  );
}

function LensGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
