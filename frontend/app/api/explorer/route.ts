import { NextRequest, NextResponse } from "next/server";
import { getReadClient } from "@/lib/genLayerClient";
import { REGISTRY_ADDRESS, type Category } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only chain lookups; a short shared cache dedupes repeat searches for
// the same dispute/wallet without hiding fresh resolutions for long.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=10, max-age=5, stale-while-revalidate=30",
};

/** Max disputes enriched per wallet lookup (each one is a chain read). */
const MAX_ADDRESS_RESULTS = 25;

/**
 * One dispute, normalized from the registry record + (when available) the
 * specialist contract's verdict.
 */
export interface ExplorerRecord {
  id: string;
  category: Category | string;
  status: "RESOLVED" | "PENDING";
  resolved: boolean;
  submitter: string;
  /** Seconds epoch the registry recorded the dispute, if known. */
  timestamp: number | null;
  /** Refund percentage once resolved (DELIVERY maps refund_due → 100/0). */
  refundPct: number | null;
  /** Specialist verdict label (e.g. MISLEADING / DELIVERED), if issued. */
  summary: string | null;
}

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
    return JSON.parse(raw as any);
  } catch {
    return raw;
  }
}

/** Registry get_dispute → parsed record, or null when unknown/not found. */
async function fetchRegistryRecord(
  client: Reader,
  disputeId: string
): Promise<any | null> {
  try {
    const record = await readJson(client, REGISTRY_ADDRESS, "get_dispute", [
      disputeId,
    ]);
    if (!record || typeof record !== "object" || record.error) return null;
    return record;
  } catch {
    return null;
  }
}

/**
 * Specialist verdict for a dispute. Every judge (including SOURCING, since
 * validate_claim gained a dispute_id) exposes a dispute-id-keyed get_verdict;
 * legacy SOURCING claims filed without a dispute_id return not_found → null.
 */
async function fetchVerdict(
  client: Reader,
  specialist: string,
  category: string,
  disputeId: string
): Promise<any | null> {
  if (!specialist) return null;
  try {
    const verdict = await readJson(
      client,
      specialist,
      "get_verdict",
      [disputeId]
    );
    if (!verdict || typeof verdict !== "object" || verdict.error) return null;
    return verdict;
  } catch {
    return null;
  }
}

function normalize(record: any, verdict: any | null): ExplorerRecord {
  const resolved = Boolean(record.resolved || verdict?.resolved);

  let refundPct: number | null = null;
  if (typeof verdict?.refund_percentage === "number") {
    refundPct = Math.max(0, Math.min(100, verdict.refund_percentage));
  } else if (typeof verdict?.refund_due === "boolean") {
    // DELIVERY adjudicator issues a full-refund boolean instead of a pct.
    refundPct = verdict.refund_due ? 100 : 0;
  }

  const ts = Number(record.timestamp);

  return {
    id: String(record.dispute_id ?? ""),
    category: String(record.category ?? "").toUpperCase(),
    status: resolved ? "RESOLVED" : "PENDING",
    resolved,
    submitter: String(record.submitter ?? ""),
    timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
    refundPct,
    summary:
      typeof verdict?.verdict === "string" && verdict.verdict
        ? verdict.verdict
        : null,
  };
}

/** Full pipeline for one id: registry record + specialist verdict. */
async function fetchDispute(
  client: Reader,
  disputeId: string
): Promise<ExplorerRecord | null> {
  const record = await fetchRegistryRecord(client, disputeId);
  if (!record) return null;
  const verdict = await fetchVerdict(
    client,
    String(record.contract_address || ""),
    String(record.category || "").toUpperCase(),
    disputeId
  );
  return normalize(record, verdict);
}

function ok(body: any) {
  return NextResponse.json(body, { headers: CACHE_HEADERS });
}

/**
 * Public dispute lookups for the Explorer page.
 *
 * GET /api/explorer?dispute=<id>      → { mode, query, records: [0..1] }
 * GET /api/explorer?address=0x...     → { mode, query, records: [0..25] }
 *
 * The registry has no list-all view, so lookups are by dispute id or by the
 * submitting wallet (get_user_disputes). Records are newest-first.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const disputeId = (sp.get("dispute") || "").trim();
  const address = (sp.get("address") || "").trim();

  if (!REGISTRY_ADDRESS) {
    return NextResponse.json(
      { error: "Registry address not configured" },
      { status: 500 }
    );
  }
  if (!disputeId && !address) {
    return NextResponse.json(
      { error: "Provide ?dispute=<id> or ?address=0x..." },
      { status: 400 }
    );
  }

  const client = getReadClient();

  try {
    if (disputeId) {
      const record = await fetchDispute(client, disputeId);
      return ok({
        mode: "dispute",
        query: disputeId,
        records: record ? [record] : [],
      });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // The registry keys user_disputes by the exact submitter hex it stored;
    // try the query as given plus its lowercase form and merge.
    const candidates = Array.from(
      new Set([address, address.toLowerCase()])
    );
    const idLists = await Promise.allSettled(
      candidates.map((a) =>
        readJson(client, REGISTRY_ADDRESS, "get_user_disputes", [a])
      )
    );

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const res of idLists) {
      if (res.status !== "fulfilled") continue;
      const list = res.value?.dispute_ids;
      if (!Array.isArray(list)) continue;
      for (const id of list) {
        const s = String(id);
        if (s && !seen.has(s)) {
          seen.add(s);
          ids.push(s);
        }
      }
    }

    // Ids are appended chronologically — keep the newest, then enrich.
    const newest = ids.slice(-MAX_ADDRESS_RESULTS).reverse();
    const settled = await Promise.allSettled(
      newest.map((id) => fetchDispute(client, id))
    );
    const records = settled
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((r): r is ExplorerRecord => r !== null)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    return ok({
      mode: "address",
      query: address,
      total: ids.length,
      records,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read from the chain" },
      { status: 502 }
    );
  }
}
