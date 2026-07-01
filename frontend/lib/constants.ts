// Shared constants for the VerBnb frontend.
//
// NOTE: This module is ADDITIVE. The canonical contract config already lives in
// `lib/contracts.ts` (CONTRACTS, CONTRACT_ADDRESSES, CATEGORIES, explorer
// helpers) and is consumed across the app. This file only adds a few cross-
// cutting constants — poll intervals, network display metadata, and a flat
// category color map — used by the animation / 3D layer and polling logic.
//
// Addresses below mirror the env-overridable fallbacks in `lib/contracts.ts`
// so nothing diverges. The frontend talks to the registry at runtime; these are
// display/reference values only.

import { CONTRACTS, CONTRACT_ADDRESSES, getChainInfo, EXPLORER_BASE } from "./contracts";

/** All 9 deployed contract addresses (registry + 4 specialists + 4 trackers). */
export const ALL_CONTRACTS = {
  REGISTRY: CONTRACTS.find((c) => c.key === "Registry")?.address || "",
  RENTAL: CONTRACTS.find((c) => c.key === "Rental")?.address || "",
  PRODUCT: CONTRACTS.find((c) => c.key === "Marketplace")?.address || "",
  SOURCING: CONTRACTS.find((c) => c.key === "Sourcing")?.address || "",
  DELIVERY: CONTRACTS.find((c) => c.key === "Delivery")?.address || "",
  APPEAL: CONTRACT_ADDRESSES.appeal_manager,
  REPUTATION: CONTRACT_ADDRESSES.reputation_tracker,
  FRAUD: CONTRACT_ADDRESSES.fraud_detector,
  ANALYTICS: CONTRACT_ADDRESSES.analytics_tracker,
} as const;

/** Active network display metadata (sourced from contracts.getChainInfo). */
export const NETWORK = {
  get CHAIN_ID() {
    return getChainInfo().chainId;
  },
  RPC: process.env.NEXT_PUBLIC_GL_RPC || "https://rpc-bradbury.genlayer.com",
  get EXPLORER() {
    return EXPLORER_BASE;
  },
  FAUCET: "https://testnet-faucet.genlayer.foundation",
  get NAME() {
    return getChainInfo().name;
  },
} as const;

/**
 * Per-phase polling cadence (ms) for the dispute consensus tracker. 0 means
 * "stop polling" — the state is terminal. Consumers MUST clear their interval
 * on unmount and when they hit a terminal phase.
 */
export const POLL_INTERVALS: Record<string, number> = {
  SUBMITTED: 3000,
  PROPOSING: 5000,
  COMMITTING: 8000,
  REVEALING: 8000,
  FINALIZED: 0,
  FAILED: 0,
};

/** Returns the poll interval for a tracker phase, defaulting to 10s. */
export function pollIntervalFor(phase?: string): number {
  if (!phase) return 10000;
  const v = POLL_INTERVALS[phase.toUpperCase()];
  return v === undefined ? 10000 : v;
}

/**
 * Flat category → accent color map (hex). Matches the per-category accents in
 * `lib/contracts.ts` CATEGORIES and is convenient for Three.js materials, which
 * take plain hex strings rather than Tailwind classes.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  RENTAL: "#7b39fc", // purple (brand)
  PRODUCT: "#06b6d4", // cyan
  SOURCING: "#10b981", // emerald
  DELIVERY: "#f59e0b", // amber
};

/** Phase → accent color (hex) for the validator orb and status visuals. */
export const PHASE_COLORS: Record<string, string> = {
  SUBMITTED: "#7b39fc", // purple (brand)
  PROPOSING: "#f59e0b", // amber — thinking
  COMMITTING: "#3b82f6", // blue — committing
  REVEALING: "#8b5cf6", // violet — revealing
  FINALIZED: "#22c55e", // green — done
  FAILED: "#ef4444", // red — error
};
