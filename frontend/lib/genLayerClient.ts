// Read-only GenLayer client + chain selection for the browser.
// Writes happen server-side (see app/api/dispute/route.ts) so no private key
// ever reaches the client.
import { createClient } from "genlayer-js";
import { testnetBradbury, localnet, studionet } from "genlayer-js/chains";

type ChainKey = "testnet_bradbury" | "localnet" | "studionet";

const CHAINS = {
  testnet_bradbury: testnetBradbury,
  localnet,
  studionet,
} as const;

export function getChain() {
  const key = (process.env.NEXT_PUBLIC_GL_NETWORK as ChainKey) || "testnet_bradbury";
  return CHAINS[key] ?? testnetBradbury;
}

// A read-only client. readContract does not require an account.
export function getReadClient() {
  return createClient({ chain: getChain() });
}

export type GLAddress = `0x${string}`;
