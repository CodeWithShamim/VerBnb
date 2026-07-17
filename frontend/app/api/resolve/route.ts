import { NextRequest, NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { localnet, studionet } from "genlayer-js/chains";
import { CONTRACT_ADDRESSES, REGISTRY_ADDRESS } from "@/lib/contracts";

export const runtime = "nodejs";

const CHAINS: Record<string, any> = {
  localnet,
  studionet,
};

async function readJson(
  client: any,
  address: string,
  functionName: string,
  args: any[],
) {
  const raw = await client.readContract({
    address: address as `0x${string}`,
    functionName,
    args,
  });
  try {
    return JSON.parse(raw as string);
  } catch {
    return null;
  }
}

// Marks a dispute resolved in the registry so platform stats (resolution rate)
// stay accurate, then records the outcome in the analytics tracker so
// /analytics has data. mark_resolved is idempotent on-chain and record_outcome
// rejects duplicates, so repeat calls are safe.
export async function POST(req: NextRequest) {
  try {
    const { disputeId, claimSnippet } = await req.json();
    if (!disputeId) {
      return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
    }
    const registry = REGISTRY_ADDRESS;
    const key = process.env.GENLAYER_PRIVATE_KEY;
    if (!registry || !key) {
      return NextResponse.json(
        { error: "Server signer or registry not configured" },
        { status: 500 },
      );
    }

    const chainKey = process.env.NEXT_PUBLIC_GL_NETWORK || "studionet";
    const chain = CHAINS[chainKey] || studionet;
    const account = createAccount(key as `0x${string}`);
    const client = createClient({ chain, account });

    const tx = await client.writeContract({
      address: registry,
      functionName: "mark_resolved",
      args: [disputeId],
      value: 0n,
    });

    // Feed the analytics tracker. Best-effort: a failure here must not undo
    // or mask the successful mark_resolved above.
    let analyticsTx: string | null = null;
    let analyticsError: string | null = null;
    const analytics = CONTRACT_ADDRESSES.analytics_tracker;
    if (analytics) {
      try {
        const record = await readJson(client, registry, "get_dispute", [
          disputeId,
        ]);
        const specialist = record?.contract_address;
        const verdict = specialist
          ? await readJson(client, specialist, "get_verdict", [disputeId])
          : null;

        if (record && verdict?.resolved && !verdict.error) {
          const filedAt = Number(record.timestamp) || 0;
          const nowSec = Math.floor(Date.now() / 1000);
          const resTime = filedAt > 0 ? Math.max(0, nowSec - filedAt) : 0;
          analyticsTx = (await client.writeContract({
            address: analytics as `0x${string}`,
            functionName: "record_outcome",
            args: [
              disputeId,
              String(record.category || ""),
              String(verdict.verdict || ""),
              Math.min(
                100,
                Math.max(0, Number(verdict.refund_percentage) || 0),
              ),
              resTime,
              0, // appeals at first resolution; appeal flow updates separately
              String(claimSnippet || "").slice(0, 500),
            ],
            value: 0n,
          })) as string;
        }
      } catch (e: any) {
        // "outcome already recorded" is expected on revisits - treat as ok.
        analyticsError = e?.message || "analytics record failed";
      }
    }

    return NextResponse.json({ disputeId, tx, analyticsTx, analyticsError });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to mark resolved" },
      { status: 500 },
    );
  }
}
