import type { Basket } from "@/src/lib/types";

// ===========================================================================
// CHECKOUT AGENT — stub.
//
// In production this executes a UPI Autopay e-mandate for autopilot orders
// (agentic payments) and books a delivery slot. Here it only simulates the
// mandate so the golden path can "complete" without touching real rails.
// ===========================================================================

export interface CheckoutResult {
  ok: boolean;
  orderId: string;
  amount: number;
  mandate: string; // UPI Autopay mandate reference (simulated)
  slot: string;
}

export function simulateCheckout(basket: Basket): CheckoutResult {
  return {
    ok: true,
    orderId: `DK-${Date.now().toString(36).toUpperCase()}`,
    amount: basket.total,
    mandate: "UPI-AUTOPAY-MANDATE-SIMULATED",
    slot: "Today, 7–9 PM",
  };
}
