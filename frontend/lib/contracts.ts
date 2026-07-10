// Contract addresses + category routing.
//
// Addresses come straight from deployments/bradbury.json (written by the
// deploy script), so a re-deploy only needs that file updated - no .env.local
// required. Specialist addresses are also discoverable at runtime via the
// registry's get_contract_for_category view.

import deployment from "../../deployments/bradbury.json";

export type Category = "RENTAL" | "PRODUCT" | "SOURCING" | "DELIVERY";

export const REGISTRY_ADDRESS = deployment.contracts
  .verBnb_registry as `0x${string}`;

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
    accent: "#7b39fc",
    gradient: "from-violet-500 to-purple-500",
    soft: "bg-violet-50",
    text: "text-violet-600",
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
  CATEGORIES,
).reduce(
  (acc, c) => {
    acc[c.slug] = c.key;
    return acc;
  },
  {} as Record<string, Category>,
);

export function newDisputeId(category: Category): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${category.toLowerCase()}-${Date.now().toString(36)}-${rand}`;
}

// Block explorer for the active GenLayer network. genlayer-js ships the URL on
// the chain object; we default to the Bradbury explorer so links work even
// before the chain object is loaded client-side.
export const EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_GL_EXPLORER ||
  "https://explorer-bradbury.genlayer.com"
).replace(/\/+$/, "");

// The explorer's JSON API - exposes per-address transaction history with live
// status, block and decoded calldata. Used by /api/transactions to build the
// platform-wide live feed across every specialist + the registry.
export const EXPLORER_API_BASE = `${EXPLORER_BASE}/api/v1`;

/**
 * Deployed specialist + registry addresses (deployments/bradbury.json). The
 * live feed pulls transactions for each of these.
 */
export const CONTRACTS: {
  key: string;
  address: string;
  category: Category | null;
}[] = [
  {
    key: "Registry",
    address: deployment.contracts.verBnb_registry,
    category: null,
  },
  {
    key: "Rental",
    address: deployment.contracts.listing_accuracy_judge,
    category: "RENTAL",
  },
  {
    key: "Marketplace",
    address: deployment.contracts.not_as_described,
    category: "PRODUCT",
  },
  {
    key: "Sourcing",
    address: deployment.contracts.ethical_sourcing,
    category: "SOURCING",
  },
  {
    key: "Delivery",
    address: deployment.contracts.delivery_adjudicator,
    category: "DELIVERY",
  },
];

/** Lower-cased address → its contract config (category lookup for feed rows). */
export const CONTRACT_BY_ADDRESS: Record<
  string,
  { key: string; category: Category | null }
> = CONTRACTS.reduce(
  (acc, c) => {
    acc[c.address.toLowerCase()] = { key: c.key, category: c.category };
    return acc;
  },
  {} as Record<string, { key: string; category: Category | null }>,
);

/** The registry contract address (env-overridable). */
export const REGISTRY_CONTRACT =
  CONTRACTS.find((c) => c.key === "Registry")?.address || "";

/**
 * Phase 2 extension tracker addresses (appeal/reputation/fraud/analytics).
 * Standalone contracts orchestrated off-chain; the registry also exposes these
 * via get_extension_addresses.
 */
export const CONTRACT_ADDRESSES = {
  registry: REGISTRY_CONTRACT,
  appeal_manager: deployment.contracts.appeal_manager,
  reputation_tracker: deployment.contracts.reputation_tracker,
  fraud_detector: deployment.contracts.fraud_detector,
  analytics_tracker: deployment.contracts.analytics_tracker,
};

// Active network metadata for display. Mirrors the genlayer-js chain objects so
// the UI can show the network name + chain id without loading the SDK client.
const NETWORKS: Record<
  string,
  { name: string; chainId: number; short: string }
> = {
  testnet_bradbury: {
    name: "GenLayer Bradbury Testnet",
    chainId: 4221,
    short: "Bradbury",
  },
  localnet: { name: "GenLayer Localnet", chainId: 61127, short: "Localnet" },
  studionet: {
    name: "GenLayer Studio Network",
    chainId: 61999,
    short: "Studionet",
  },
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
