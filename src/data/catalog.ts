import type { Category, DietaryTag, Sku } from "./types";

// ---------------------------------------------------------------------------
// Mock catalog for the fictional retailer "Apna Aisle" (Bengaluru dark stores).
// ~90 Indian grocery SKUs. National brands (Aashirvaad, Fortune, Amul, Tata…)
// plus the retailer's own private label "Apna Select".
//
// The numbers a shopper never sees — marginPct, stock, expiryRisk — live right
// next to the ones they do. That co-location is the point: the Margin agent
// reads the private columns, the Trust Arbiter guards them, and nothing raw
// leaks into shopper-facing text.
// ---------------------------------------------------------------------------

type Unit = Sku["unit"];

interface Raw {
  id: string;
  name: string;
  brand: string;
  category: Category;
  packSize: string;
  packUnits: number;
  unit: Unit;
  price: number;
  marginPct: number;
  privateLabel?: boolean;
  privateLabelPairId?: string;
  expiryRisk?: boolean;
  expiryDiscountPct?: number;
  stock: number;
  dietaryTags: DietaryTag[];
}

// Builder: derives the honest unit price (₹ per kg / L / pc) so the Budget &
// Substitution agent can reason on ₹/kg, not pack price.
function mk(r: Raw): Sku {
  const perUnitBase =
    r.unit === "g" || r.unit === "ml" ? r.packUnits / 1000 : r.packUnits;
  const unitPrice = Math.round((r.price / perUnitBase) * 100) / 100;
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    packSize: r.packSize,
    packUnits: r.packUnits,
    unit: r.unit,
    price: r.price,
    unitPrice,
    marginPct: r.marginPct,
    privateLabel: r.privateLabel ?? false,
    privateLabelPairId: r.privateLabelPairId,
    expiryRisk: r.expiryRisk ?? false,
    expiryDiscountPct: r.expiryDiscountPct,
    stock: r.stock,
    dietaryTags: r.dietaryTags,
  };
}

export const CATALOG: Sku[] = [
  // --- Atta / flour -------------------------------------------------------
  mk({ id: "atta-aashirvaad-5", name: "Aashirvaad Whole Wheat Atta", brand: "Aashirvaad", category: "atta-flour", packSize: "5 kg", packUnits: 5, unit: "kg", price: 330, marginPct: 0.08, privateLabelPairId: "atta-dks-5", stock: 120, dietaryTags: ["veg", "contains-gluten"] }),
  // Private-label equivalent: genuinely cheaper AND higher margin — the clean steer.
  mk({ id: "atta-dks-5", name: "Apna Select Whole Wheat Atta", brand: "Apna Select", category: "atta-flour", packSize: "5 kg", packUnits: 5, unit: "kg", price: 299, marginPct: 0.34, privateLabel: true, stock: 200, dietaryTags: ["veg", "contains-gluten"] }),
  mk({ id: "atta-pillsbury-5", name: "Pillsbury Chakki Fresh Atta", brand: "Pillsbury", category: "atta-flour", packSize: "5 kg", packUnits: 5, unit: "kg", price: 345, marginPct: 0.09, stock: 60, dietaryTags: ["veg", "contains-gluten"] }),
  mk({ id: "maida-dks-1", name: "Apna Select Maida", brand: "Apna Select", category: "atta-flour", packSize: "1 kg", packUnits: 1, unit: "kg", price: 52, marginPct: 0.3, privateLabel: true, stock: 90, dietaryTags: ["veg", "contains-gluten"] }),
  mk({ id: "besan-dks-500", name: "Apna Select Besan", brand: "Apna Select", category: "atta-flour", packSize: "500 g", packUnits: 500, unit: "g", price: 68, marginPct: 0.31, privateLabel: true, stock: 75, dietaryTags: ["veg"] }),

  // --- Rice ---------------------------------------------------------------
  mk({ id: "rice-india-gate-5", name: "India Gate Basmati Rice Classic", brand: "India Gate", category: "rice", packSize: "5 kg", packUnits: 5, unit: "kg", price: 680, marginPct: 0.1, privateLabelPairId: "rice-dks-5", stock: 80, dietaryTags: ["veg"] }),
  mk({ id: "rice-dks-5", name: "Apna Select Basmati Rice", brand: "Apna Select", category: "rice", packSize: "5 kg", packUnits: 5, unit: "kg", price: 599, marginPct: 0.33, privateLabel: true, stock: 140, dietaryTags: ["veg"] }),
  mk({ id: "rice-daawat-1", name: "Daawat Rozana Super Basmati", brand: "Daawat", category: "rice", packSize: "1 kg", packUnits: 1, unit: "kg", price: 118, marginPct: 0.11, stock: 100, dietaryTags: ["veg"] }),
  mk({ id: "rice-sona-dks-5", name: "Apna Select Sona Masoori Rice", brand: "Apna Select", category: "rice", packSize: "5 kg", packUnits: 5, unit: "kg", price: 415, marginPct: 0.29, privateLabel: true, stock: 160, dietaryTags: ["veg"] }),

  // --- Dal / pulses -------------------------------------------------------
  mk({ id: "toor-tata-1", name: "Tata Sampann Toor Dal", brand: "Tata Sampann", category: "dal-pulses", packSize: "1 kg", packUnits: 1, unit: "kg", price: 165, marginPct: 0.12, privateLabelPairId: "toor-dks-1", stock: 130, dietaryTags: ["veg"] }),
  mk({ id: "toor-dks-1", name: "Apna Select Toor Dal", brand: "Apna Select", category: "dal-pulses", packSize: "1 kg", packUnits: 1, unit: "kg", price: 149, marginPct: 0.32, privateLabel: true, stock: 180, dietaryTags: ["veg"] }),
  mk({ id: "moong-dks-500", name: "Apna Select Moong Dal", brand: "Apna Select", category: "dal-pulses", packSize: "500 g", packUnits: 500, unit: "g", price: 82, marginPct: 0.31, privateLabel: true, stock: 110, dietaryTags: ["veg"] }),
  mk({ id: "chana-tata-1", name: "Tata Sampann Chana Dal", brand: "Tata Sampann", category: "dal-pulses", packSize: "1 kg", packUnits: 1, unit: "kg", price: 95, marginPct: 0.13, stock: 90, dietaryTags: ["veg"] }),
  mk({ id: "rajma-dks-500", name: "Apna Select Rajma", brand: "Apna Select", category: "dal-pulses", packSize: "500 g", packUnits: 500, unit: "g", price: 88, marginPct: 0.3, privateLabel: true, stock: 70, dietaryTags: ["veg"] }),
  mk({ id: "urad-dks-500", name: "Apna Select Urad Dal", brand: "Apna Select", category: "dal-pulses", packSize: "500 g", packUnits: 500, unit: "g", price: 79, marginPct: 0.3, privateLabel: true, stock: 65, dietaryTags: ["veg"] }),

  // --- Edible oil ---------------------------------------------------------
  // Shopper deliberately chose Fortune 1L in the past (cheap, trusted).
  mk({ id: "oil-fortune-1", name: "Fortune Sunlite Refined Sunflower Oil", brand: "Fortune", category: "edible-oil", packSize: "1 L", packUnits: 1, unit: "L", price: 140, marginPct: 0.09, stock: 150, dietaryTags: ["veg"] }),
  // Pricier private-label sunflower oil. Higher margin, but MORE expensive than the
  // Fortune the shopper chose — the Margin agent will covet this; the arbiter blocks it.
  mk({ id: "oil-dks-sunflower-1", name: "Apna Select Premium Sunflower Oil", brand: "Apna Select", category: "edible-oil", packSize: "1 L", packUnits: 1, unit: "L", price: 175, marginPct: 0.36, privateLabel: true, stock: 120, dietaryTags: ["veg"] }),
  mk({ id: "oil-saffola-1", name: "Saffola Gold Refined Oil", brand: "Saffola", category: "edible-oil", packSize: "1 L", packUnits: 1, unit: "L", price: 185, marginPct: 0.1, stock: 70, dietaryTags: ["veg"] }),
  mk({ id: "oil-dks-mustard-1", name: "Apna Select Kachi Ghani Mustard Oil", brand: "Apna Select", category: "edible-oil", packSize: "1 L", packUnits: 1, unit: "L", price: 155, marginPct: 0.34, privateLabel: true, stock: 85, dietaryTags: ["veg"] }),
  // High-margin groundnut (peanut) oil — a peanut-allergic household must never be steered here.
  mk({ id: "oil-dks-groundnut-1", name: "Apna Select Groundnut Oil", brand: "Apna Select", category: "edible-oil", packSize: "1 L", packUnits: 1, unit: "L", price: 210, marginPct: 0.38, privateLabel: true, stock: 60, dietaryTags: ["veg", "contains-peanut"] }),

  // --- Dairy --------------------------------------------------------------
  mk({ id: "milk-amul-1", name: "Amul Taaza Toned Milk", brand: "Amul", category: "dairy", packSize: "1 L", packUnits: 1, unit: "L", price: 68, marginPct: 0.06, expiryRisk: true, expiryDiscountPct: 0.15, stock: 300, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "milk-nandini-1", name: "Nandini Goodlife Toned Milk", brand: "Nandini", category: "dairy", packSize: "1 L", packUnits: 1, unit: "L", price: 62, marginPct: 0.07, stock: 260, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "paneer-amul-200", name: "Amul Fresh Paneer", brand: "Amul", category: "dairy", packSize: "200 g", packUnits: 200, unit: "g", price: 95, marginPct: 0.14, privateLabelPairId: "paneer-dks-200", expiryRisk: true, expiryDiscountPct: 0.2, stock: 45, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "paneer-dks-200", name: "Apna Select Fresh Paneer", brand: "Apna Select", category: "dairy", packSize: "200 g", packUnits: 200, unit: "g", price: 89, marginPct: 0.32, privateLabel: true, stock: 80, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "curd-nandini-500", name: "Nandini Curd", brand: "Nandini", category: "dairy", packSize: "500 g", packUnits: 500, unit: "g", price: 40, marginPct: 0.12, expiryRisk: true, expiryDiscountPct: 0.15, stock: 90, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "butter-amul-100", name: "Amul Butter", brand: "Amul", category: "dairy", packSize: "100 g", packUnits: 100, unit: "g", price: 58, marginPct: 0.08, stock: 140, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "ghee-dks-500", name: "Apna Select Cow Ghee", brand: "Apna Select", category: "dairy", packSize: "500 ml", packUnits: 500, unit: "ml", price: 315, marginPct: 0.33, privateLabel: true, stock: 55, dietaryTags: ["veg", "contains-dairy"] }),
  mk({ id: "cheese-amul-200", name: "Amul Cheese Slices", brand: "Amul", category: "dairy", packSize: "200 g", packUnits: 200, unit: "g", price: 130, marginPct: 0.15, stock: 65, dietaryTags: ["veg", "contains-dairy"] }),

  // --- Vegetables ---------------------------------------------------------
  mk({ id: "onion-1", name: "Onion", brand: "Apna Farm", category: "vegetables", packSize: "1 kg", packUnits: 1, unit: "kg", price: 38, marginPct: 0.22, stock: 400, dietaryTags: ["veg"] }),
  mk({ id: "tomato-1", name: "Tomato", brand: "Apna Farm", category: "vegetables", packSize: "1 kg", packUnits: 1, unit: "kg", price: 42, marginPct: 0.24, expiryRisk: true, expiryDiscountPct: 0.25, stock: 220, dietaryTags: ["veg"] }),
  mk({ id: "potato-1", name: "Potato", brand: "Apna Farm", category: "vegetables", packSize: "1 kg", packUnits: 1, unit: "kg", price: 34, marginPct: 0.21, stock: 500, dietaryTags: ["veg"] }),
  mk({ id: "paneer-cap-500", name: "Capsicum", brand: "Apna Farm", category: "vegetables", packSize: "500 g", packUnits: 500, unit: "g", price: 45, marginPct: 0.26, stock: 120, dietaryTags: ["veg"] }),
  mk({ id: "spinach-1", name: "Palak (Spinach)", brand: "Apna Farm", category: "vegetables", packSize: "250 g", packUnits: 250, unit: "g", price: 25, marginPct: 0.3, expiryRisk: true, expiryDiscountPct: 0.3, stock: 60, dietaryTags: ["veg"] }),
  mk({ id: "carrot-500", name: "Carrot", brand: "Apna Farm", category: "vegetables", packSize: "500 g", packUnits: 500, unit: "g", price: 30, marginPct: 0.27, stock: 150, dietaryTags: ["veg"] }),
  mk({ id: "beans-500", name: "French Beans", brand: "Apna Farm", category: "vegetables", packSize: "500 g", packUnits: 500, unit: "g", price: 36, marginPct: 0.28, expiryRisk: true, expiryDiscountPct: 0.2, stock: 70, dietaryTags: ["veg"] }),
  mk({ id: "cauliflower-1", name: "Cauliflower", brand: "Apna Farm", category: "vegetables", packSize: "1 pc", packUnits: 1, unit: "pcs", price: 40, marginPct: 0.25, stock: 90, dietaryTags: ["veg"] }),
  mk({ id: "ginger-200", name: "Ginger", brand: "Apna Farm", category: "vegetables", packSize: "200 g", packUnits: 200, unit: "g", price: 28, marginPct: 0.3, stock: 110, dietaryTags: ["veg"] }),
  mk({ id: "garlic-200", name: "Garlic", brand: "Apna Farm", category: "vegetables", packSize: "200 g", packUnits: 200, unit: "g", price: 44, marginPct: 0.29, stock: 100, dietaryTags: ["veg"] }),
  mk({ id: "greenchilli-100", name: "Green Chilli", brand: "Apna Farm", category: "vegetables", packSize: "100 g", packUnits: 100, unit: "g", price: 12, marginPct: 0.3, stock: 130, dietaryTags: ["veg"] }),
  mk({ id: "coriander-100", name: "Coriander Leaves", brand: "Apna Farm", category: "vegetables", packSize: "100 g", packUnits: 100, unit: "g", price: 15, marginPct: 0.32, expiryRisk: true, expiryDiscountPct: 0.3, stock: 80, dietaryTags: ["veg"] }),

  // --- Fruits -------------------------------------------------------------
  mk({ id: "banana-1", name: "Robusta Banana", brand: "Apna Farm", category: "fruits", packSize: "1 dozen", packUnits: 12, unit: "pcs", price: 60, marginPct: 0.2, expiryRisk: true, expiryDiscountPct: 0.2, stock: 200, dietaryTags: ["veg"] }),
  mk({ id: "apple-1", name: "Shimla Apple", brand: "Apna Farm", category: "fruits", packSize: "1 kg", packUnits: 1, unit: "kg", price: 165, marginPct: 0.23, stock: 90, dietaryTags: ["veg"] }),
  mk({ id: "pomegranate-1", name: "Pomegranate", brand: "Apna Farm", category: "fruits", packSize: "1 kg", packUnits: 1, unit: "kg", price: 180, marginPct: 0.24, expiryRisk: true, expiryDiscountPct: 0.25, stock: 50, dietaryTags: ["veg"] }),
  mk({ id: "orange-1", name: "Nagpur Orange", brand: "Apna Farm", category: "fruits", packSize: "1 kg", packUnits: 1, unit: "kg", price: 90, marginPct: 0.22, stock: 110, dietaryTags: ["veg"] }),
  mk({ id: "grapes-500", name: "Green Grapes", brand: "Apna Farm", category: "fruits", packSize: "500 g", packUnits: 500, unit: "g", price: 70, marginPct: 0.26, expiryRisk: true, expiryDiscountPct: 0.3, stock: 40, dietaryTags: ["veg"] }),

  // --- Snacks -------------------------------------------------------------
  mk({ id: "biscuit-parleg-800", name: "Parle-G Gold Biscuits", brand: "Parle", category: "snacks", packSize: "800 g", packUnits: 800, unit: "g", price: 90, marginPct: 0.14, stock: 200, dietaryTags: ["veg", "contains-gluten"] }),
  mk({ id: "chips-lays-52", name: "Lay's Classic Salted Chips", brand: "Lay's", category: "snacks", packSize: "52 g", packUnits: 52, unit: "g", price: 20, marginPct: 0.18, stock: 250, dietaryTags: ["veg"] }),
  mk({ id: "namkeen-haldiram-200", name: "Haldiram's Aloo Bhujia", brand: "Haldiram's", category: "snacks", packSize: "200 g", packUnits: 200, unit: "g", price: 52, marginPct: 0.16, stock: 160, dietaryTags: ["veg"] }),
  // High-margin peanut snack — the allergy trap. The Margin agent will nominate it; arbiter blocks.
  mk({ id: "chikki-dks-200", name: "Apna Select Peanut Chikki", brand: "Apna Select", category: "snacks", packSize: "200 g", packUnits: 200, unit: "g", price: 75, marginPct: 0.4, privateLabel: true, stock: 90, dietaryTags: ["veg", "contains-peanut"] }),
  mk({ id: "pb-dks-340", name: "Apna Select Peanut Butter", brand: "Apna Select", category: "snacks", packSize: "340 g", packUnits: 340, unit: "g", price: 165, marginPct: 0.42, privateLabel: true, stock: 70, dietaryTags: ["veg", "contains-peanut"] }),
  mk({ id: "biscuit-dks-500", name: "Apna Select Marie Biscuits", brand: "Apna Select", category: "snacks", packSize: "500 g", packUnits: 500, unit: "g", price: 58, marginPct: 0.35, privateLabel: true, stock: 120, dietaryTags: ["veg", "contains-gluten"] }),

  // --- Spices / staples ---------------------------------------------------
  mk({ id: "salt-tata-1", name: "Tata Salt", brand: "Tata", category: "spices", packSize: "1 kg", packUnits: 1, unit: "kg", price: 28, marginPct: 0.1, stock: 300, dietaryTags: ["veg"] }),
  mk({ id: "sugar-dks-1", name: "Apna Select Sugar", brand: "Apna Select", category: "spices", packSize: "1 kg", packUnits: 1, unit: "kg", price: 45, marginPct: 0.28, privateLabel: true, stock: 220, dietaryTags: ["veg"] }),
  mk({ id: "turmeric-dks-200", name: "Apna Select Turmeric Powder", brand: "Apna Select", category: "spices", packSize: "200 g", packUnits: 200, unit: "g", price: 48, marginPct: 0.33, privateLabel: true, stock: 100, dietaryTags: ["veg"] }),
  mk({ id: "chilli-everest-200", name: "Everest Red Chilli Powder", brand: "Everest", category: "spices", packSize: "200 g", packUnits: 200, unit: "g", price: 72, marginPct: 0.15, stock: 90, dietaryTags: ["veg"] }),
  mk({ id: "garam-mdh-100", name: "MDH Garam Masala", brand: "MDH", category: "spices", packSize: "100 g", packUnits: 100, unit: "g", price: 85, marginPct: 0.16, stock: 80, dietaryTags: ["veg"] }),
  mk({ id: "mustard-dks-100", name: "Apna Select Mustard Seeds", brand: "Apna Select", category: "spices", packSize: "100 g", packUnits: 100, unit: "g", price: 22, marginPct: 0.3, privateLabel: true, stock: 110, dietaryTags: ["veg"] }),
  mk({ id: "jeera-dks-100", name: "Apna Select Cumin Seeds", brand: "Apna Select", category: "spices", packSize: "100 g", packUnits: 100, unit: "g", price: 44, marginPct: 0.31, privateLabel: true, stock: 95, dietaryTags: ["veg"] }),

  // --- Beverages ----------------------------------------------------------
  mk({ id: "tea-redlabel-500", name: "Red Label Tea", brand: "Brooke Bond", category: "beverages", packSize: "500 g", packUnits: 500, unit: "g", price: 275, marginPct: 0.12, privateLabelPairId: "tea-dks-500", stock: 100, dietaryTags: ["veg"] }),
  mk({ id: "tea-dks-500", name: "Apna Select Assam Tea", brand: "Apna Select", category: "beverages", packSize: "500 g", packUnits: 500, unit: "g", price: 235, marginPct: 0.34, privateLabel: true, stock: 130, dietaryTags: ["veg"] }),
  mk({ id: "coffee-bru-200", name: "Bru Instant Coffee", brand: "Bru", category: "beverages", packSize: "200 g", packUnits: 200, unit: "g", price: 310, marginPct: 0.13, stock: 60, dietaryTags: ["veg"] }),
  mk({ id: "horlicks-500", name: "Horlicks Classic Malt", brand: "Horlicks", category: "beverages", packSize: "500 g", packUnits: 500, unit: "g", price: 265, marginPct: 0.11, stock: 70, dietaryTags: ["veg", "contains-dairy"] }),

  // --- Breakfast ----------------------------------------------------------
  mk({ id: "oats-quaker-1", name: "Quaker Oats", brand: "Quaker", category: "breakfast", packSize: "1 kg", packUnits: 1, unit: "kg", price: 195, marginPct: 0.14, privateLabelPairId: "oats-dks-1", stock: 90, dietaryTags: ["veg"] }),
  mk({ id: "oats-dks-1", name: "Apna Select Rolled Oats", brand: "Apna Select", category: "breakfast", packSize: "1 kg", packUnits: 1, unit: "kg", price: 159, marginPct: 0.33, privateLabel: true, stock: 120, dietaryTags: ["veg"] }),
  mk({ id: "cornflakes-kelloggs-475", name: "Kellogg's Corn Flakes", brand: "Kellogg's", category: "breakfast", packSize: "475 g", packUnits: 475, unit: "g", price: 210, marginPct: 0.15, stock: 55, dietaryTags: ["veg"] }),
  mk({ id: "poha-dks-500", name: "Apna Select Thick Poha", brand: "Apna Select", category: "breakfast", packSize: "500 g", packUnits: 500, unit: "g", price: 42, marginPct: 0.3, privateLabel: true, stock: 140, dietaryTags: ["veg"] }),
  mk({ id: "bread-britannia-400", name: "Britannia Whole Wheat Bread", brand: "Britannia", category: "bakery", packSize: "400 g", packUnits: 400, unit: "g", price: 55, marginPct: 0.13, expiryRisk: true, expiryDiscountPct: 0.25, stock: 80, dietaryTags: ["veg", "contains-gluten"] }),
  mk({ id: "eggs-6", name: "Farm Fresh Eggs", brand: "Apna Farm", category: "bakery", packSize: "6 pcs", packUnits: 6, unit: "pcs", price: 48, marginPct: 0.18, expiryRisk: true, expiryDiscountPct: 0.15, stock: 150, dietaryTags: ["non-veg", "egg"] }),

  // --- Cleaning / personal care ------------------------------------------
  mk({ id: "detergent-surf-1", name: "Surf Excel Easy Wash", brand: "Surf Excel", category: "cleaning", packSize: "1 kg", packUnits: 1, unit: "kg", price: 130, marginPct: 0.12, privateLabelPairId: "detergent-dks-1", stock: 100, dietaryTags: ["veg"] }),
  mk({ id: "detergent-dks-1", name: "Apna Select Detergent Powder", brand: "Apna Select", category: "cleaning", packSize: "1 kg", packUnits: 1, unit: "kg", price: 99, marginPct: 0.35, privateLabel: true, stock: 150, dietaryTags: ["veg"] }),
  mk({ id: "dishwash-vim-500", name: "Vim Dishwash Liquid", brand: "Vim", category: "cleaning", packSize: "500 ml", packUnits: 500, unit: "ml", price: 110, marginPct: 0.14, stock: 90, dietaryTags: ["veg"] }),
  mk({ id: "soap-dove-100", name: "Dove Beauty Bar", brand: "Dove", category: "personal-care", packSize: "100 g", packUnits: 100, unit: "g", price: 62, marginPct: 0.16, stock: 120, dietaryTags: ["veg"] }),
  mk({ id: "toothpaste-colgate-200", name: "Colgate MaxFresh", brand: "Colgate", category: "personal-care", packSize: "200 g", packUnits: 200, unit: "g", price: 115, marginPct: 0.15, stock: 100, dietaryTags: ["veg"] }),
  mk({ id: "shampoo-dks-340", name: "Apna Select Anti-Dandruff Shampoo", brand: "Apna Select", category: "personal-care", packSize: "340 ml", packUnits: 340, unit: "ml", price: 178, marginPct: 0.36, privateLabel: true, stock: 70, dietaryTags: ["veg"] }),
];

// Fast lookups used throughout the agent layer.
const BY_ID = new Map(CATALOG.map((s) => [s.id, s]));
export function getSku(id: string): Sku | undefined {
  return BY_ID.get(id);
}
export function requireSku(id: string): Sku {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown SKU: ${id}`);
  return s;
}
