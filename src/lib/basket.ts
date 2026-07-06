import { getSku } from "@/src/data/catalog";
import type { Basket, BasketItem } from "./types";

// Basket math kept in one place so totals and savings are always consistent.
// `savings` accumulates rupees the shopper avoided paying versus the naive
// baseline (expiry discounts applied, cheaper private-label swaps taken).

export function emptyBasket(): Basket {
  return { items: [], total: 0, savings: 0 };
}

export function recompute(basket: Basket): Basket {
  const total = basket.items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { ...basket, total: Math.round(total) };
}

export function addItem(
  basket: Basket,
  skuId: string,
  qty: number,
  effectivePrice?: number,
): Basket {
  const sku = getSku(skuId);
  if (!sku) return basket;
  const price = effectivePrice ?? sku.price;
  const items = [...basket.items];
  const existing = items.find((i) => i.skuId === skuId);
  if (existing) {
    existing.qty += qty;
    existing.lineTotal = Math.round(existing.qty * existing.price);
  } else {
    items.push({
      skuId,
      name: sku.name,
      brand: sku.brand,
      qty,
      price,
      lineTotal: Math.round(qty * price),
    });
  }
  return recompute({ ...basket, items });
}

export function removeItem(basket: Basket, skuId: string): Basket {
  return recompute({
    ...basket,
    items: basket.items.filter((i) => i.skuId !== skuId),
  });
}

// Swap one line for another SKU, keeping quantity. Records any price drop as savings.
export function swapItem(
  basket: Basket,
  fromSkuId: string,
  toSkuId: string,
  effectivePrice?: number,
): Basket {
  const line = basket.items.find((i) => i.skuId === fromSkuId);
  const toSku = getSku(toSkuId);
  if (!line || !toSku) return basket;
  const newPrice = effectivePrice ?? toSku.price;
  const saved = Math.max(0, (line.price - newPrice) * line.qty);
  let next = removeItem(basket, fromSkuId);
  next = addItem(next, toSkuId, line.qty, newPrice);
  next.savings = Math.round(basket.savings + saved);
  return next;
}

export function skuIds(basket: Basket): string[] {
  return basket.items.map((i) => i.skuId);
}

export function itemsSummary(basket: Basket): string {
  if (basket.items.length === 0) return "(empty)";
  return basket.items
    .map((i) => `${i.qty}× ${i.name} (₹${i.lineTotal})`)
    .join(", ");
}

export type { BasketItem };
