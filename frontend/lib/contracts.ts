// Contract addresses + category routing.
//
// The frontend only needs the REGISTRY address (set in .env.local). Specialist
// addresses are discovered at runtime via the registry's
// get_contract_for_category view, so the UI never hardcodes them. The static
// fallbacks below are filled from deployments/bradbury.json after deploy.

export type Category = "RENTAL" | "PRODUCT" | "SOURCING" | "DELIVERY";

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_VERBNB_REGISTRY ||
  "") as `0x${string}`;

export interface CategoryMeta {
  key: Category;
  slug: string;
  title: string;
  tagline: string;
  /** Specialist write method + its argument names, in order. */
  method: string;
  icon: string;
  /** Tailwind-friendly accent tokens for per-category theming. */
  accent: string; // hex
  gradient: string; // "from-x to-y" tailwind classes
  soft: string; // soft bg tint class
  text: string; // accent text class
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  RENTAL: {
    key: "RENTAL",
    slug: "rental",
    title: "Rental",
    tagline: "Airbnb-style listing accuracy disputes",
    method: "raise_dispute",
    icon: "home",
    accent: "#6366f1",
    gradient: "from-indigo-500 to-violet-500",
    soft: "bg-indigo-50",
    text: "text-indigo-600",
  },
  PRODUCT: {
    key: "PRODUCT",
    slug: "marketplace",
    title: "Marketplace",
    tagline: "“Not as described” product arbitration",
    method: "raise_dispute",
    icon: "box",
    accent: "#06b6d4",
    gradient: "from-cyan-500 to-sky-500",
    soft: "bg-cyan-50",
    text: "text-cyan-600",
  },
  SOURCING: {
    key: "SOURCING",
    slug: "sourcing",
    title: "Sourcing",
    tagline: "Brand ethical-sourcing claim validation",
    method: "validate_claim",
    icon: "leaf",
    accent: "#10b981",
    gradient: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50",
    text: "text-emerald-600",
  },
  DELIVERY: {
    key: "DELIVERY",
    slug: "delivery",
    title: "Delivery",
    tagline: "Courier delivery-proof adjudication",
    method: "raise_dispute",
    icon: "truck",
    accent: "#f59e0b",
    gradient: "from-amber-500 to-orange-500",
    soft: "bg-amber-50",
    text: "text-amber-600",
  },
};

export const SLUG_TO_CATEGORY: Record<string, Category> = Object.values(
  CATEGORIES
).reduce((acc, c) => {
  acc[c.slug] = c.key;
  return acc;
}, {} as Record<string, Category>);

export function newDisputeId(category: Category): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${category.toLowerCase()}-${Date.now().toString(36)}-${rand}`;
}
