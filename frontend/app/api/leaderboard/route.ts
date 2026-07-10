import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_ADDRESSES = 20;

// Reputation views are read-only chain state; cache briefly and serve stale
// while revalidating so a refresh spree doesn't hammer the RPC.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, max-age=15, stale-while-revalidate=60",
};

/** Raw JSON payload of reputation_tracker.get_reputation (see contracts/reputation_tracker.py). */
interface RawReputation {
  address: string;
  disputes_filed: number;
  disputes_won: number;
  disputes_lost: number;
  validator_rounds: number;
  validator_agreements: number;
  appeal_filed: number;
  appeal_won: number;
  overall_score: number;
  last_active: number;
  exists: boolean;
}

function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num * 100) / den) : null;
}

/**
 * GET /api/leaderboard?addresses=0xa,0xb,...
 *
 * Reads reputation_tracker.get_reputation for each address (max 20) and
 * returns normalized rows:
 *
 *   { configured: true, entries: [{
 *       address, credibility, disputesFiled, disputesWon, disputesLost,
 *       winRate, validatorRounds, validatorAccuracy, appealsFiled,
 *       appealsWon, lastActive, exists
 *   } | { address, error }] }
 *
 * Per-address failures become { address, error } entries; the batch itself
 * never 500s. Missing tracker config returns { configured: false }.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("addresses") || "";

  // Validate + dedupe (case-insensitive), then cap.
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const part of raw.split(",")) {
    const addr = part.trim();
    if (!ADDRESS_RE.test(addr)) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(addr);
    if (addresses.length >= MAX_ADDRESSES) break;
  }

  const tracker = CONTRACT_ADDRESSES.reputation_tracker;
  if (!tracker) {
    return NextResponse.json(
      { configured: false, entries: [] },
      { headers: CACHE_HEADERS },
    );
  }
  if (addresses.length === 0) {
    return NextResponse.json(
      { configured: true, entries: [] },
      { headers: CACHE_HEADERS },
    );
  }

  const client = getReadClient();

  const settled = await Promise.allSettled(
    addresses.map(async (address) => {
      const json = (await client.readContract({
        address: tracker as `0x${string}`,
        functionName: "get_reputation",
        args: [address],
      })) as string;
      return JSON.parse(json) as RawReputation;
    }),
  );

  const entries = settled.map((result, i) => {
    const address = addresses[i];
    if (result.status === "rejected") {
      const msg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason ?? "chain read failed");
      return { address, error: msg.slice(0, 200) };
    }
    const r = result.value;
    return {
      address,
      credibility: Number(r.overall_score) || 0,
      disputesFiled: Number(r.disputes_filed) || 0,
      disputesWon: Number(r.disputes_won) || 0,
      disputesLost: Number(r.disputes_lost) || 0,
      winRate: pct(Number(r.disputes_won) || 0, (Number(r.disputes_won) || 0) + (Number(r.disputes_lost) || 0)),
      validatorRounds: Number(r.validator_rounds) || 0,
      validatorAccuracy: pct(Number(r.validator_agreements) || 0, Number(r.validator_rounds) || 0),
      appealsFiled: Number(r.appeal_filed) || 0,
      appealsWon: Number(r.appeal_won) || 0,
      lastActive: Number(r.last_active) || 0,
      exists: Boolean(r.exists),
    };
  });

  return NextResponse.json(
    { configured: true, entries },
    { headers: CACHE_HEADERS },
  );
}
