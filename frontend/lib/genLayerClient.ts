// Read-only GenLayer client + chain selection for the browser.
// Writes happen server-side (see app/api/dispute/route.ts) so no private key
// ever reaches the client.
import { createClient } from "genlayer-js";
import { localnet, studionet } from "genlayer-js/chains";

type ChainKey = "localnet" | "studionet";

const CHAINS = {
  localnet,
  studionet,
} as const;

export function getChain() {
  const key = (process.env.NEXT_PUBLIC_GL_NETWORK as ChainKey) || "studionet";
  return CHAINS[key] ?? studionet;
}

// genlayer-js Network name (client.connect / wallet flows) for each ChainKey.
const NETWORK_NAMES: Record<ChainKey, "localnet" | "studionet"> = {
  localnet: "localnet",
  studionet: "studionet",
};

/** The genlayer-js Network name for the active chain (e.g. "studionet"). */
export function getNetworkName() {
  const key = (process.env.NEXT_PUBLIC_GL_NETWORK as ChainKey) || "studionet";
  return NETWORK_NAMES[key] ?? "studionet";
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
