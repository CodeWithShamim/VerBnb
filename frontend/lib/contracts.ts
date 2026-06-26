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

// Block explorer for the active GenLayer network. genlayer-js ships the URL on
// the chain object; we default to the Bradbury explorer so links work even
// before the chain object is loaded client-side.
export const EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_GL_EXPLORER || "https://explorer-bradbury.genlayer.com"
).replace(/\/+$/, "");

// The explorer's JSON API — exposes per-address transaction history with live
// status, block and decoded calldata. Used by /api/transactions to build the
// platform-wide live feed across every specialist + the registry.
export const EXPLORER_API_BASE = `${EXPLORER_BASE}/api/v1`;

/**
 * Deployed specialist + registry addresses (deployments/bradbury.json). The
 * live feed pulls transactions for each of these. Env vars override so the
 * same UI works against a re-deploy without a code change.
 */
export const CONTRACTS: { key: string; address: string; category: Category | null }[] = [
  {
    key: "Registry",
    address:
      process.env.NEXT_PUBLIC_VERBNB_REGISTRY ||
      "0x8aA6527B539814c454ee178dd7CE8cAd011834eB",
    category: null,
  },
  {
    key: "Rental",
    address:
      process.env.NEXT_PUBLIC_VERBNB_RENTAL ||
      "0x76e3Ff31Ca5cB4e6ce46EF109c52272F27151b32",
    category: "RENTAL",
  },
  {
    key: "Marketplace",
    address:
      process.env.NEXT_PUBLIC_VERBNB_PRODUCT ||
      "0xBF6Efed489B28c2680FE0b3eF8Dffe4288e50548",
    category: "PRODUCT",
  },
  {
    key: "Sourcing",
    address:
      process.env.NEXT_PUBLIC_VERBNB_SOURCING ||
      "0xb516DB96E8DefE26dE624dfF1f7D0802a828996D",
    category: "SOURCING",
  },
  {
    key: "Delivery",
    address:
      process.env.NEXT_PUBLIC_VERBNB_DELIVERY ||
      "0x63FFE6DE2988ABC6f49F3b3fd56415ef2A16d3AF",
    category: "DELIVERY",
  },
];

/** Lower-cased address → its contract config (category lookup for feed rows). */
export const CONTRACT_BY_ADDRESS: Record<
  string,
  { key: string; category: Category | null }
> = CONTRACTS.reduce((acc, c) => {
  acc[c.address.toLowerCase()] = { key: c.key, category: c.category };
  return acc;
}, {} as Record<string, { key: string; category: Category | null }>);

/** The registry contract address (env-overridable). */
export const REGISTRY_CONTRACT =
  CONTRACTS.find((c) => c.key === "Registry")?.address || "";

// Active network metadata for display. Mirrors the genlayer-js chain objects so
// the UI can show the network name + chain id without loading the SDK client.
const NETWORKS: Record<string, { name: string; chainId: number; short: string }> = {
  testnet_bradbury: { name: "GenLayer Bradbury Testnet", chainId: 4221, short: "Bradbury" },
  localnet: { name: "GenLayer Localnet", chainId: 61127, short: "Localnet" },
  studionet: { name: "GenLayer Studio Network", chainId: 61999, short: "Studionet" },
};

/** The network the app is configured to talk to. */
export function getChainInfo() {
  const key = process.env.NEXT_PUBLIC_GL_NETWORK || "testnet_bradbury";
  return NETWORKS[key] || NETWORKS.testnet_bradbury;
}

/** Explorer URL for a transaction hash (empty string if no hash). */
export function explorerTx(hash?: string): string {
  if (!hash) return "";
  return `${EXPLORER_BASE}/tx/${hash}`;
}

/** Explorer URL for an address/contract (empty string if no address). */
export function explorerAddress(address?: string): string {
  if (!address) return "";
  return `${EXPLORER_BASE}/address/${address}`;
}

/** One transaction in the live feed, normalized from the explorer API. */
export interface ChainTxRow {
  /** GenLayer transaction hash. */
  hash: string;
  /** Contract method called (decoded from calldata). */
  method: string;
  /** Dispute id (args[0]) when the method carries one, else null. */
  disputeId: string | null;
  /** Category inferred from the contract or register_dispute args. */
  category: Category | null;
  /** Human label for the contract that received the tx. */
  contractKey: string;
  /** Contract address the tx was sent to. */
  contract: string;
  /** Sender address. */
  from: string;
  /** Live transaction status (e.g. finalized, accepted, committing). */
  status: string;
  /** Starting block number. */
  block: number | null;
  /** Best-known seconds epoch (finalization → activation → submission). */
  timestamp: number | null;
}
