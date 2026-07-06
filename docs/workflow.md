# Message lifecycle

How one shopper message becomes a basket, a set of suggestions, and a full glass-box
trace. This is slide 6 of the deck, in prose. The code is
[`src/agents/orchestrator.ts`](../src/agents/orchestrator.ts).

## The turn, step by step

1. **Ingress.** `POST /api/chat` (`{sessionId, message}`) or `POST /api/replenish`
   (agent-initiated, no message). In live mode the route enforces a per-IP rate
   limit and a 500-char input cap before any model is touched.

2. **Mode resolution.** `resolveMode()` picks the driver: `MockDriver` (no API
   key) or `LiveDriver` (a real hosted model). This is the *only* fork between mock and
   live — the orchestration below is identical either way.

3. **Intent classification (SLM tier).** One cheap call maps the message to
   `plan_meal | replenish | substitute | budget | general`. Live: the SLM-tier model.
   Mock: a keyword heuristic (also the live fallback on error). Logged to the trace.

4. **The tool-calling loop (concierge, frontier tier).** Up to 6 iterations. The
   concierge is given five tools and drives them:

   | Tool | Backing agent(s) |
   |------|------------------|
   | `search_catalog` | Discovery |
   | `update_basket` | Basket Builder |
   | `check_budget` | Budget & Substitution |
   | `get_replenishment_draft` | Replenishment (deterministic) |
   | `get_offers` | Margin → **Trust Arbiter** → Inventory |

   Live: the model emits `tool_use` blocks; we execute the real tool and feed the
   `tool_result` back. Mock: a scripted plan emits the *same real tool calls*. Each
   tool mutates a shared `ToolContext` (basket, trace, rulings) and appends a trace
   entry naming the agent that fired.

5. **The two-sided core — `get_offers`.** This is where the thesis lives:
   - The **Margin agent** (`margin.ts`, deterministic) reads the private columns —
     margin %, private-label pairs, expiry risk, stock — and proposes *every*
     plausible steer. It does **not** self-censor; that is the referee's job.
   - Each candidate carries a shopper-facing "why" that, by construction, contains
     **no margin numbers**, plus an internal margin reason for the Retailer Lens.
   - The **Trust Arbiter** (`trust-arbiter.ts`, deterministic) rules on every
     candidate against R1–R5. Only approved steers within the R5 budget are applied
     to the basket; blocked and queued steers are logged but withheld.

6. **Compose.** The concierge writes one reply. Live: the model composes from the
   tool results. Mock: `composeMockReply()` narrates the *real* post-tool basket and
   the *real* approved rulings — so the text is scripted but never invents state.

7. **Egress.** The route returns `{reply, basket, trace, rulings, mode, intent}`.
   The UI renders `reply` + `basket`, shows approved steers as chips, and pipes
   `trace` + `rulings` into the Retailer Lens.

## Designed failure paths

The deck claims these are designed, not hoped away. In this prototype:

- **SKU resolution ambiguity** — `search_catalog` returns ranked candidates; the
  concierge is instructed never to fabricate a SKU, and asks when unsure.
- **Single-purchase items** — the replenishment model needs ≥2 buys to infer an
  interval, so it *skips* one-off purchases (e.g. Tata Salt) rather than guessing.
- **Steer overload** — R5 caps surfaced steers at 2; the rest are marked `queued`
  (safe, deferred), not dropped silently.
- **Allergy / cheaper-choice traps** — R1 and R2 hard-block, even when the margin
  agent ranks the blocked steer highest. See the worked example below.

---

## Worked transcript — "my usual weekly order" (the two-sided proof)

Agent-initiated (the "Sunday 6 PM" draft). Household: the Sharma family, veg,
**peanut allergy**, and a **deliberate past choice of Fortune refined oil (₹140)**.

**Intent:** `replenish` (SLM tier).

**Replenishment (deterministic)** drafts 14 SKUs from 8 weeks of history — each
with a learned median interval, e.g. *Amul milk ~7d (last 8d ago)*, *Aashirvaad
atta ~18d (last 22d ago)*, *Fortune oil ~21d (last 22d ago)*. Salt is skipped: a
single past purchase has no inferable interval.

**Margin agent (deterministic)** proposes 9 candidate steers over that basket,
including three it likes for margin that the shopper must never simply be handed:

| Steer | Internal margin | Fate |
|-------|-----------------|------|
| Attach Apna Select **Peanut Butter** | 42% (Δ +42 pts) | ⛔ |
| Swap Fortune oil → Apna Select **Groundnut Oil** | 38% (Δ +29 pts) | ⛔ |
| Swap Fortune oil → Apna Select **Premium Sunflower Oil** | 36% (Δ +27 pts) | ⛔ |
| Swap Aashirvaad **Atta** → Apna Select Atta | 34% (Δ +26 pts) | ✅ |
| Discount Coriander / Tomato / Banana / Milk / Curd (expiry) | waste-avoidance | ✅ ×1, queued ×4 |

**Trust Arbiter (deterministic policy)** rules on all nine:

```
BLOCKED  Attach Apna Select Peanut Butter
         [R1] tagged "contains-peanut"; household has a peanut allergy.
BLOCKED  Swap Fortune Sunflower Oil → Apna Select Groundnut Oil
         [R1] groundnut oil is tagged "contains-peanut"; household has a peanut allergy.
BLOCKED  Swap Fortune Sunflower Oil → Apna Select Premium Sunflower Oil
         [R2] Fortune (₹140) was a deliberate choice and is cheaper than DKS Premium (₹175).
APPROVED Discount Coriander Leaves
         [R1–R5] discounted and dated (use by Tue, 7 Jul); no constraint touched.
QUEUED   Discount Tomato / Banana / Milk / Curd
         [R5] steer budget of 2 reached — safe, but queued for next week.
APPROVED Swap Aashirvaad Atta → Apna Select Atta
         [R1–R5] genuinely equivalent, same-or-lower price (₹31 cheaper).
```

**Concierge composes** (the shopper sees only the approved two, each with its why):

> Here's your usual weekly basket, drafted from your last 8 weeks of orders —
> 14 items, ₹2296.
> I also flagged 2 things worth a look, each with the reason:
> • 30% off — fresh stock priced to clear, use by Tue, 7 Jul.
> • Same atta flour, our Apna Select label — ₹31 cheaper per pack.
> Want me to tweak anything before you approve? A tap and the UPI mandate books
> your slot. You've saved ₹35 so far.

The peanut butter and the pricier oil — the two highest-margin steers the retailer
agent wanted — never reach the shopper. That is the whole product: margin
optimisation that is *provably* shopper-safe, because safety is a deterministic
agent in the architecture, not a line in a prompt.

_Regenerate this end-to-end with `npm run demo:trace`. Saved runs for all three
golden paths are in [`../transcripts/`](../transcripts/)._
