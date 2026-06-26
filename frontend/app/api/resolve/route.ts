import { NextRequest, NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, localnet, studionet } from "genlayer-js/chains";

export const runtime = "nodejs";

const CHAINS: Record<string, any> = {
  testnet_bradbury: testnetBradbury,
  localnet,
  studionet,
};

// Marks a dispute resolved in the registry so platform stats (resolution rate)
// stay accurate. mark_resolved is idempotent on-chain, so repeat calls are safe.
export async function POST(req: NextRequest) {
  try {
    const { disputeId } = await req.json();
    if (!disputeId) {
      return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
    }
    const registry = process.env.NEXT_PUBLIC_VERBNB_REGISTRY as `0x${string}`;
    const key = process.env.GENLAYER_PRIVATE_KEY;
    if (!registry || !key) {
      return NextResponse.json(
        { error: "Server signer or registry not configured" },
        { status: 500 }
      );
    }

    const chainKey = process.env.NEXT_PUBLIC_GL_NETWORK || "testnet_bradbury";
    const chain = CHAINS[chainKey] || testnetBradbury;
    const account = createAccount(key as `0x${string}`);
    const client = createClient({ chain, account });

    const tx = await client.writeContract({
      address: registry,
      functionName: "mark_resolved",
      args: [disputeId],
      value: 0n,
    });

    return NextResponse.json({ disputeId, tx });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to mark resolved" },
      { status: 500 }
    );
  }
}
