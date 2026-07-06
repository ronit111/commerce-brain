// Domain types for the Commerce Brain mock data layer.
// These describe the retailer's catalog and one household's history.
// Everything here is mock, but the *shape* mirrors a real PIM + CDP feed:
// catalog metadata comes from the retailer's PIM, order history from the CDP.

export type Category =
  | "atta-flour"
  | "rice"
  | "dal-pulses"
  | "edible-oil"
  | "dairy"
  | "vegetables"
  | "fruits"
  | "snacks"
  | "spices"
  | "beverages"
  | "cleaning"
  | "personal-care"
  | "bakery"
  | "breakfast";

// Dietary tags a shopper can filter on, and that the Trust Arbiter enforces.
export type DietaryTag =
  | "veg"
  | "non-veg"
  | "egg"
  | "contains-peanut"
  | "contains-gluten"
  | "contains-dairy"
  | "jain";

export interface Sku {
  id: string;
  name: string;
  brand: string;
  category: Category;
  packSize: string; // human label, e.g. "5 kg", "1 L", "500 g"
  packUnits: number; // numeric size in the unit below (for unit-price math)
  unit: "kg" | "L" | "g" | "ml" | "pcs" | "dozen";
  price: number; // shelf price in INR
  unitPrice: number; // INR per kg / L / pc — the honest comparison number
  marginPct: number; // retailer contribution margin, 0..1 (NEVER shopper-visible)
  privateLabel: boolean; // true for the retailer's own "Apna Select" line
  privateLabelPairId?: string; // if a national brand, the equivalent private-label SKU
  expiryRisk: boolean; // perishable close to date — retailer wants it moved
  expiryDiscountPct?: number; // discount offered to clear expiry-risk stock
  stock: number; // dark-store units on hand
  dietaryTags: DietaryTag[];
}

export interface OrderLine {
  skuId: string;
  qty: number;
}

export interface PastOrder {
  date: string; // ISO date
  lines: OrderLine[];
}

export interface Household {
  id: string;
  label: string;
  city: string;
  size: number;
  monthlyBudget: number; // INR
  dietaryPrefs: DietaryTag[]; // preferences the household shops by
  allergies: DietaryTag[]; // HARD constraints — the arbiter never overrides these
  // SKUs the shopper has deliberately chosen in the past over a pricier option.
  // The arbiter uses this to enforce "never suppress a cheaper equivalent
  // the shopper previously chose."
  deliberatelyChosen: string[];
  history: PastOrder[];
}
