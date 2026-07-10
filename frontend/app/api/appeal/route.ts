import { NextRequest, NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, localnet, studionet } from "genlayer-js/chains";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

export const runtime = "nodejs";

const CHAINS: Record<string, any> = {
  testnet_bradbury: testnetBradbury,
  localnet,
  studionet,
};

function serverClient() {
  const key = process.env.GENLAYER_PRIVATE_KEY;
  if (!key) throw new Error("GENLAYER_PRIVATE_KEY not configured on the server");
  const chainKey = process.env.NEXT_PUBLIC_GL_NETWORK || "testnet_bradbury";
  const chain = CHAINS[chainKey] || testnetBradbury;
  const account = createAccount(key as `0x${string}`);
  return createClient({ chain, account });
}

/**
 * Files an appeal in the appeal_manager contract.
 *
 * POST body:
 *   disputeId, appellant, originalVerdictAt (epoch seconds), originalRefundPct,
 *   partyA, partyB, reason, evidenceUrl
 *
 * Returns the created appeal id + tx hash.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const appealManager = CONTRACT_ADDRESSES.appeal_manager;
    if (!appealManager) {
      return NextResponse.json(
        { error: "Appeal manager address missing from deployments/bradbury.json" },
        { status: 500 }
      );
    }

    const {
      disputeId,
      appellant,
      originalVerdictAt,
      originalRefundPct,
      partyA,
      partyB,
      reason,
      evidenceUrl,
    } = body;

    if (!disputeId || !appellant || !reason) {
      return NextResponse.json(
        { error: "Missing disputeId, appellant, or reason" },
        { status: 400 }
      );
    }

    const client = serverClient();
    const args = [
      String(disputeId),
      String(appellant),
      BigInt(originalVerdictAt || 0),
      Number(originalRefundPct || 0),
      String(partyA || appellant),
      String(partyB || ""),
      String(reason),
      String(evidenceUrl || ""),
    ];

    const tx = await client.writeContract({
      address: appealManager as `0x${string}`,
      functionName: "create_appeal",
      args,
      value: 0n,
    });

    // Predictable appeal id format: <dispute>-appeal-<round>. The first round is 1.
    return NextResponse.json({
      disputeId,
      appealId: `${disputeId}-appeal-1`,
      tx,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to file appeal" },
      { status: 500 }
    );
  }
}
