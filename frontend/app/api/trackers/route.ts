import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";
import { CONTRACT_ADDRESSES, REGISTRY_ADDRESS } from "@/lib/contracts";

export const runtime = "nodejs";

// Read-only chain views: cache briefly at the edge/browser and serve stale
// while revalidating. Dedupes the many badge/alert reads a single page fires
// without showing meaningfully stale data.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=15, max-age=10, stale-while-revalidate=60",
};

function ok(body: any) {
  return NextResponse.json(body, { headers: CACHE_HEADERS });
}

/**
 * Read-only gateway to the Phase 2 tracker contracts
 * (reputation / fraud / analytics / appeal_manager).
 *
 * GET /api/trackers?resource=<name>&...params
 *
 * resource values:
 *   reputation      ?address=0x..
 *   user_stats      ?address=0x..
 *   activity        ?address=0x..&limit=50
 *   fraud_flags     ?address=0x..
 *   has_high_flag   ?address=0x..
 *   analytics_all
 *   platform_health
 *   category_stats  ?category=RENTAL
 *   similar         ?category=RENTAL&snippet=...
 *   appeals         ?disputeId=...
 *   appeal          ?appealId=...
 *   appeal_outcome  ?disputeId=...&round=N   (round-bound specialist outcome;
 *                   omit round for the latest resolved round)
 *
 * All values come straight from contract views and are JSON-decoded where the
 * view returns a JSON string. Missing contract addresses return a soft
 * { configured: false } payload so the UI can degrade gracefully.
 */

type Reader = ReturnType<typeof getReadClient>;

async function readJson(
  client: Reader,
  address: string,
  functionName: string,
  args: any[]
): Promise<any> {
  const raw = (await client.readContract({
    address: address as `0x${string}`,
    functionName,
    args,
  })) as string;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource") || "";
  const client = getReadClient();
  const {
    reputation_tracker,
    fraud_detector,
    analytics_tracker,
    appeal_manager,
  } = CONTRACT_ADDRESSES;

  try {
    switch (resource) {
      case "reputation": {
        if (!reputation_tracker) return ok({ configured: false });
        const address = sp.get("address") || "";
        return ok(await readJson(client, reputation_tracker, "get_reputation", [address]));
      }
      case "user_stats": {
        if (!reputation_tracker) return ok({ configured: false });
        const address = sp.get("address") || "";
        return ok(await readJson(client, reputation_tracker, "get_user_stats", [address]));
      }
      case "activity": {
        if (!reputation_tracker) return ok({ configured: false, events: [] });
        const address = sp.get("address") || "";
        const limit = parseInt(sp.get("limit") || "20", 10);
        return ok(
          await readJson(client, reputation_tracker, "get_activity_log", [address, limit])
        );
      }
      case "credibility": {
        if (!reputation_tracker) return ok({ configured: false, score: 0 });
        const address = sp.get("address") || "";
        const score = await client.readContract({
          address: reputation_tracker as `0x${string}`,
          functionName: "get_credibility_score",
          args: [address],
        });
        return ok({ score: Number(score) });
      }
      case "fraud_flags": {
        if (!fraud_detector) return ok({ configured: false, flags: [] });
        const address = sp.get("address") || "";
        return ok(await readJson(client, fraud_detector, "get_fraud_flags", [address]));
      }
      case "has_high_flag": {
        if (!fraud_detector) return ok({ configured: false, high: false });
        const address = sp.get("address") || "";
        const high = await client.readContract({
          address: fraud_detector as `0x${string}`,
          functionName: "has_high_severity_flag",
          args: [address],
        });
        return ok({ high: Boolean(high) });
      }
      case "platform_stats": {
        if (!REGISTRY_ADDRESS) return ok({ configured: false });
        return ok(await readJson(client, REGISTRY_ADDRESS, "get_platform_stats", []));
      }
      case "analytics_all": {
        if (!analytics_tracker) return ok({ configured: false });
        return ok(await readJson(client, analytics_tracker, "get_all_stats", []));
      }
      case "platform_health": {
        if (!analytics_tracker) return ok({ configured: false });
        return ok(await readJson(client, analytics_tracker, "get_platform_health", []));
      }
      case "category_stats": {
        if (!analytics_tracker) return ok({ configured: false });
        const category = sp.get("category") || "";
        return ok(
          await readJson(client, analytics_tracker, "get_category_stats", [category])
        );
      }
      case "similar": {
        if (!analytics_tracker) return ok({ configured: false, results: [] });
        const category = sp.get("category") || "";
        const snippet = sp.get("snippet") || "";
        return ok(
          await readJson(client, analytics_tracker, "get_similar_disputes", [
            category,
            snippet,
          ])
        );
      }
      case "appeals": {
        if (!appeal_manager) return ok({ configured: false, appeals: [] });
        const disputeId = sp.get("disputeId") || "";
        return ok(
          await readJson(client, appeal_manager, "get_appeals_for_dispute", [disputeId])
        );
      }
      case "appeal": {
        if (!appeal_manager) return ok({ configured: false });
        const appealId = sp.get("appealId") || "";
        return ok(await readJson(client, appeal_manager, "get_appeal", [appealId]));
      }
      case "appeal_outcome": {
        // The specialist judge's on-chain AppealOutcome, bound to its recorded
        // consensus round. The specialist is discovered via the registry so the
        // UI never supplies (or trusts) a contract address.
        if (!REGISTRY_ADDRESS) return ok({ configured: false, resolved: false });
        const disputeId = sp.get("disputeId") || "";
        const round = parseInt(sp.get("round") || "0", 10);
        const record = await readJson(client, REGISTRY_ADDRESS, "get_dispute", [disputeId]);
        const specialist = record?.contract_address;
        if (!specialist) return ok({ configured: false, resolved: false });
        const outcome =
          round > 0
            ? await readJson(client, specialist, "get_appeal_outcome_for_round", [
                disputeId,
                round,
              ])
            : await readJson(client, specialist, "get_appeal_outcome", [disputeId]);
        return ok(outcome);
      }
      default:
        return NextResponse.json(
          { error: `unknown resource: ${resource}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "tracker read failed", configured: true },
      { status: 200 }
    );
  }
}
