# Golden path 2 — The usual weekly order (the two-sided proof)

_Saved from a real run against the mock-mode API (`/api/replenish`). Deterministic agents (replenishment, margin, arbiter) ran for real; the concierge language is scripted in mock mode._

---

**[Sunday, 6:00 PM — agent-initiated draft]**

_intent: `replenish` (SLM tier) · mode: `mock`_

**Concierge:**

> Here's your usual weekly basket, drafted from your last 8 weeks of orders — 14 items, ₹2296.
>
> I also flagged 2 things worth a look, each with the reason:
> • 30% off — fresh stock priced to clear, use by Tue, 7 Jul.
> • Same atta flour, our Apna Select label — ₹31 cheaper per pack.
>
> Want me to tweak anything before you approve? A tap and the UPI mandate books your slot. You've saved ₹35 so far.

**Trust Arbiter rulings (Retailer Lens):**

| decision | steer | rule | reason |
|---|---|---|---|
| **APPROVED** | Discount Coriander Leaves | passed R1–R5 | Discounted and dated (use by Tue, 7 Jul); shopper saves money, no constraint touched. |
| **QUEUED** | Discount Tomato | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |
| **QUEUED** | Discount Robusta Banana | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |
| **QUEUED** | Discount Amul Taaza Toned Milk | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |
| **QUEUED** | Discount Nandini Curd | R5: max 2 flagged steers per draft basket | Steer budget of 2 reached — safe, but queued for next week's draft. |
| **BLOCKED** | Attach Apna Select Peanut Butter | R1: dietary/allergy constraints are absolute | Apna Select Peanut Butter is tagged "contains-peanut"; household has a peanut allergy. |
| **BLOCKED** | Swap Fortune Sunlite Refined Sunflower Oil → Apna Select Groundnut Oil | R1: dietary/allergy constraints are absolute | Apna Select Groundnut Oil is tagged "contains-peanut"; household has a peanut allergy. |
| **BLOCKED** | Swap Fortune Sunlite Refined Sunflower Oil → Apna Select Premium Sunflower Oil | R2: never suppress a cheaper equivalent already chosen | Fortune Sunlite Refined Sunflower Oil (₹140) was a deliberate choice and is cheaper than Apna Select Premium Sunflower Oil (₹175). |
| **APPROVED** | Swap Aashirvaad Whole Wheat Atta → Apna Select Whole Wheat Atta | passed R1–R5 | Genuinely equivalent, same-or-lower price, constraint-safe. |

**Basket:** 14 lines · total ₹2296 · saved ₹35
