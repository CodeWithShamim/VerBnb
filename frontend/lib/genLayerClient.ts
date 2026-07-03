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

// A read-only client. readContract does not require an account. The client is
// stateless, so one shared instance serves every caller (avoids re-building
// transport/chain config on each API request or component mount).
let readClient: ReturnType<typeof createClient> | null = null;

export function getReadClient() {
  if (!readClient) readClient = createClient({ chain: getChain() });
  return readClient;
}

export type GLAddress = `0x${string}`;
