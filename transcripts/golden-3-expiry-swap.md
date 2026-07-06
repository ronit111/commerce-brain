# Golden path 3 — Swap expiring items for discounts

_Saved from a real run against the mock-mode API (`/api/chat`). Deterministic agents (replenishment, margin, arbiter) ran for real; the concierge language is scripted in mock mode._

---

**Shopper:** Swap anything expiring soon for discounts

_intent: `substitute` (SLM tier) · mode: `mock`_

**Concierge:**

> Found 2 items you can save on right now, each with why:
> • 30% off — fresh stock priced to clear, use by Tue, 7 Jul.
> • 25% off — fresh stock priced to clear, use by Tue, 7 Jul.
>
> Basket total is now ₹2317. You've saved ₹14 so far.

**Trust Arbiter rulings (Retailer Lens):**

| decision | steer | rule | reason |
|---|---|---|---|
| **APPROVED** | Discount Coriander Leaves | passed R1–R5 | Discounted and dated (use by Tue, 7 Jul); shopper saves money, no constraint touched. |
| **APPROVED** | Discount Tomato | passed R1–R5 | Discounted and dated (use by Tue, 7 Jul); shopper saves money, no constraint touched. |
| **QUEUED** | Discount Robusta Banana | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |
| **QUEUED** | Discount Amul Taaza Toned Milk | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |
| **QUEUED** | Discount Nandini Curd | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |

**Basket:** 14 lines · total ₹2317 · saved ₹14
