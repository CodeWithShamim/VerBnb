import { NextRequest, NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, localnet, studionet } from "genlayer-js/chains";
import { CONTRACT_ADDRESSES, REGISTRY_ADDRESS } from "@/lib/contracts";

export const runtime = "nodejs";

const CHAINS: Record<string, any> = {
  testnet_bradbury: testnetBradbury,
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

/**
 * Resolves an appeal ENTIRELY ON-CHAIN, deriving the verdict from authenticated
 * contract state rather than trusting an off-chain-computed outcome:
 *
 *   1. Look up the dispute's specialist judge + category from the registry.
 *   2. specialist.resolve_appeal(disputeId, round) — the judge re-runs GenLayer
 *      validator consensus over ITS OWN stored evidence with a stricter bar and
 *      records an authenticated AppealOutcome.
 *   3. appeal_manager.finalize_appeal_from_state(appealId, specialist) — the
 *      appeal manager reads that AppealOutcome back via get_contract_at().view()
 *      and finalizes. The server signer only sequences the two calls; it never
 *      supplies the verdict.
 *
 * POST body: { disputeId, appealId?, round? }
 */
export async function POST(req: NextRequest) {
  try {
    const { disputeId, appealId, round } = await req.json();
    if (!disputeId) {
      return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
    }

    const appealManager = CONTRACT_ADDRESSES.appeal_manager;
    const registry = REGISTRY_ADDRESS;
    const key = process.env.GENLAYER_PRIVATE_KEY;
    if (!appealManager || !registry || !key) {
      return NextResponse.json(
        { error: "Server signer, registry, or appeal manager not configured" },
        { status: 500 },
      );
    }

    const chainKey = process.env.NEXT_PUBLIC_GL_NETWORK || "testnet_bradbury";
    const chain = CHAINS[chainKey] || testnetBradbury;
    const account = createAccount(key as `0x${string}`);
    const client = createClient({ chain, account });

    // (1) Authenticated specialist address for this dispute, from the registry.
    const record = await readJson(client, registry, "get_dispute", [disputeId]);
    const specialist = record?.contract_address;
    if (!specialist) {
      return NextResponse.json(
        { error: `No specialist found for dispute ${disputeId}` },
        { status: 404 },
      );
    }

    // Resolve the appeal id + round. Prefer the on-chain appeal record; fall
    // back to the "<dispute>-appeal-<n>" convention.
    let resolvedAppealId = appealId as string | undefined;
    let resolvedRound = Number(round) || 0;
    if (!resolvedAppealId || !resolvedRound) {
      const appeals = await readJson(
        client,
        appealManager,
        "get_appeals_for_dispute",
        [disputeId],
      );
      const open = (appeals?.appeals || []).find(
        (a: any) => a.appeal_status !== "FINALIZED",
      );
      if (open) {
        resolvedAppealId = resolvedAppealId || open.appeal_id;
        resolvedRound = resolvedRound || Number(open.new_consensus_round) || 1;
      }
    }
    if (!resolvedAppealId) {
      return NextResponse.json(
        { error: `No open appeal found for dispute ${disputeId}` },
        { status: 404 },
      );
    }
    resolvedRound = resolvedRound || 1;

    // (2) Re-run consensus on the specialist over its authenticated evidence.
    const resolveTx = await client.writeContract({
      address: specialist as `0x${string}`,
      functionName: "resolve_appeal",
      args: [disputeId, resolvedRound],
      value: 0n,
    });
    // The finalize step reads the outcome the specialist just wrote, so the
    // re-run must land first.
    await client.waitForTransactionReceipt({
      hash: resolveTx,
      status: "FINALIZED",
    } as any);

    // (3) Finalize by reading the authenticated on-chain outcome.
    const finalizeTx = await client.writeContract({
      address: appealManager as `0x${string}`,
      functionName: "finalize_appeal_from_state",
      args: [resolvedAppealId, specialist],
      value: 0n,
    });

    const outcome = await readJson(client, specialist, "get_appeal_outcome", [
      disputeId,
    ]);

    return NextResponse.json({
      disputeId,
      appealId: resolvedAppealId,
      round: resolvedRound,
      specialist,
      resolveTx,
      finalizeTx,
      outcome,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to resolve appeal on-chain" },
      { status: 500 },
    );
  }
}
