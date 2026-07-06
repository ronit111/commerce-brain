"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMark, BrandWord } from "./Brand";

export interface Steer {
  summary: string;
  why: string;
}

export interface ChatMsg {
  id: string;
  role: "shopper" | "concierge" | "system";
  text: string;
  steers?: Steer[];
}

const CANNED = [
  { label: "Plan dinner for 4 · under ₹800 · veg", message: "Plan dinner for 4 under Rs 800, veg" },
  { label: "My usual weekly order", message: "My usual weekly order" },
  { label: "Swap anything expiring for discounts", message: "Swap anything expiring soon for discounts" },
];

export function ChatPanel({
  messages,
  busy,
  onSend,
  onReplenish,
  onApprove,
  canApprove,
}: {
  messages: ChatMsg[];
  busy: boolean;
  onSend: (message: string) => void;
  onReplenish: () => void;
  onApprove: () => void;
  canApprove: boolean;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const m = draft.trim();
    if (!m || busy) return;
    onSend(m);
    setDraft("");
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-[var(--dk-paper)]" style={{ borderColor: "var(--dk-line)" }}>
      {/* concierge header */}
      <header className="flex items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--dk-line)" }}>
        <BrandMark size={34} />
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight"><BrandWord /> Concierge</p>
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--dk-muted)" }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--dk-green)" }} />
            Online · your household&rsquo;s shopping agent
          </p>
        </div>
      </header>

      {/* messages */}
      <div ref={scrollRef} className="dk-scroll flex-1 overflow-y-auto px-4 py-4" style={{ background: "var(--dk-cream)" }}>
        <div className="flex flex-col gap-3">
          {messages.map((m) =>
            m.role === "system" ? (
              <div key={m.id} className="my-1 flex items-center justify-center">
                <span className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ background: "var(--dk-amber-soft)", color: "var(--dk-amber)" }}>
                  {m.text}
                </span>
              </div>
            ) : (
              <div key={m.id} className={`flex ${m.role === "shopper" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] dk-fade">
                  <div
                    className="whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                    style={
                      m.role === "shopper"
                        ? { background: "var(--dk-green)", color: "#fff", borderBottomRightRadius: 6 }
                        : { background: "var(--dk-paper)", color: "var(--dk-ink)", border: "1px solid var(--dk-line)", borderBottomLeftRadius: 6 }
                    }
                  >
                    {m.text}
                  </div>
                  {m.steers && m.steers.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {m.steers.map((s, i) => (
                        <SteerChip key={i} steer={s} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--dk-paper)", borderColor: "var(--dk-line)", borderBottomLeftRadius: 6 }}>
                <span className="flex gap-1">
                  <Dot d={0} /><Dot d={0.2} /><Dot d={0.4} />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="border-t px-4 py-3" style={{ borderColor: "var(--dk-line)" }}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            onClick={onReplenish}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: "var(--dk-green)", color: "#fff" }}
          >
            <ClockIcon /> Sunday 6 PM draft
          </button>
          {CANNED.map((c) => (
            <button
              key={c.message}
              onClick={() => onSend(c.message)}
              disabled={busy}
              className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--dk-cream)] disabled:opacity-50"
              style={{ borderColor: "var(--dk-line)", color: "var(--dk-ink)" }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {canApprove && (
          <button
            onClick={onApprove}
            disabled={busy}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-transform active:scale-[0.99] disabled:opacity-50"
            style={{ background: "var(--dk-ink)", color: "#fff" }}
          >
            Approve &amp; pay via UPI Autopay
          </button>
        )}

        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the concierge…"
            disabled={busy}
            className="flex-1 rounded-full border px-4 py-2.5 text-[13px] outline-none focus:border-[var(--dk-green)] disabled:opacity-50"
            style={{ borderColor: "var(--dk-line)", background: "var(--dk-cream)", color: "var(--dk-ink)" }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40"
            style={{ background: "var(--dk-green)" }}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

function SteerChip({ steer }: { steer: Steer }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border px-3 py-2 dk-fade" style={{ borderColor: "var(--dk-green)", background: "var(--dk-green-soft)" }}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        <CheckIcon />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium leading-snug" style={{ color: "var(--dk-green-dark)" }}>{steer.why}</p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--dk-muted)" }}>
          {steer.summary} · cleared by the Trust Arbiter
        </p>
      </div>
    </div>
  );
}

function Dot({ d }: { d: number }) {
  return <span className="dk-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--dk-muted)", animationDelay: `${d}s` }} />;
}
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dk-green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
