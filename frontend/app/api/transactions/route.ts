import { NextRequest, NextResponse } from "next/server";
import { abi } from "genlayer-js";
import { getChain } from "@/lib/genLayerClient";
import {
  CONTRACTS,
  CONTRACT_BY_ADDRESS,
  EXPLORER_API_BASE,
  CATEGORIES,
  type Category,
  type ChainTxRow,
} from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live platform-wide transaction feed.
//
// Two sources, picked by network capability:
//  - Explorer API (Bradbury-style networks): one call per contract, decodes
//    each transaction's method + dispute id from its base64 JSON calldata.
//  - Studio JSON-RPC fallback (studionet/localnet, no explorer): the
//    sim_getTransactionsForAddress method returns every transaction for an
//    address with live status; calldata is GenLayer binary format, decoded
//    via genlayer-js. Responses are heavy (full consensus data), so one
//    merged fan-out is cached in-process for a short TTL.
//
// Status is whatever the source reports right now - nothing is persisted.

const VALID_CATEGORIES = new Set(Object.keys(CATEGORIES));

/**
 * Dispute id + category for a decoded call, shared by both feed sources.
 *
 * args[0] is the dispute id for raise_dispute / register_dispute /
 * mark_resolved. validate_claim keys by brand and carries the (optional)
 * dispute id as its 5th arg. For register_dispute, args[1] is the category -
 * a stronger signal than the contract (the registry handles all categories).
 */
function deriveIds(
  method: string,
  args: any[],
  contractCategory: Category | null,
): { disputeId: string | null; category: Category | null } {
  const idMethods = new Set([
    "raise_dispute",
    "register_dispute",
    "mark_resolved",
  ]);
  let disputeId: string | null =
    idMethods.has(method) && typeof args[0] === "string" ? args[0] : null;
  if (method === "validate_claim" && typeof args[4] === "string" && args[4]) {
    disputeId = args[4];
  }

  let category: Category | null = contractCategory;
  if (method === "register_dispute" && typeof args[1] === "string") {
    const cat = args[1].toUpperCase();
    if (VALID_CATEGORIES.has(cat)) category = cat as Category;
  }

  return { disputeId, category };
}

/* ─── Source 1: explorer API (networks that have one) ─── */

interface ExplorerTx {
  hash: string;
  from_address?: string;
  to_address?: string;
  status?: string;
  submission_timestamp?: number;
  activation_timestamp?: number;
  finalization_timestamp?: number;
  starting_block_number?: string | number;
  data?: {
    function?: string;
    params?: {
      encoded_data?: {
        calldata?: { encoding?: string; content?: string };
      };
    };
  };
}

/** Decode { method, args } from a transaction's base64 JSON calldata. */
function decodeExplorerCalldata(
  tx: ExplorerTx,
): { method: string; args: any[] } | null {
  const c = tx?.data?.params?.encoded_data?.calldata;
  if (c?.encoding === "base64" && c.content) {
    try {
      const parsed = JSON.parse(Buffer.from(c.content, "base64").toString());
      if (parsed && typeof parsed === "object") {
        return {
          method: parsed.method || tx?.data?.function || "-",
          args: parsed.args || [],
        };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

function bestTimestamp(tx: ExplorerTx): number | null {
  const t =
    Number(tx.finalization_timestamp) ||
    Number(tx.activation_timestamp) ||
    Number(tx.submission_timestamp);
  return Number.isFinite(t) && t > 0 ? t : null;
}

function normalizeExplorer(
  tx: ExplorerTx,
  contractKey: string,
  contractCategory: Category | null,
): ChainTxRow {
  const decoded = decodeExplorerCalldata(tx);
  const method = decoded?.method || tx?.data?.function || "-";
  const args = decoded?.args || [];
  const { disputeId, category } = deriveIds(method, args, contractCategory);

  const toAddr = (tx.to_address || "").toLowerCase();
  const known = CONTRACT_BY_ADDRESS[toAddr];

  return {
    hash: tx.hash,
    method,
    disputeId,
    category,
    contractKey: known?.key || contractKey,
    contract: tx.to_address || "",
    from: tx.from_address || "",
    status: (tx.status || "").toUpperCase() || "PENDING",
    block: Number(tx.starting_block_number) || null,
    timestamp: bestTimestamp(tx),
  };
}

async function fetchFromExplorer(
  address: string,
  contractKey: string,
  category: Category | null,
  pageSize: number,
): Promise<ChainTxRow[]> {
  const url = `${EXPLORER_API_BASE}/transactions?address=${address}&page=1&page_size=${pageSize}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const txs: ExplorerTx[] = Array.isArray(json?.transactions)
      ? json.transactions
      : [];
    return txs.map((t) => normalizeExplorer(t, contractKey, category));
  } catch {
    return [];
  }
}

/* ─── Source 2: studio JSON-RPC (studionet/localnet, no explorer) ─── */

interface StudioTx {
  hash: string;
  from_address?: string;
  to_address?: string;
  status?: string;
  created_at?: string;
  data?: { calldata?: string };
}

/** Decode { method, args } from GenLayer binary calldata (base64). */
function decodeStudioCalldata(
  b64: string | undefined,
): { method: string; args: any[] } | null {
  if (!b64) return null;
  try {
    const decoded: any = abi.calldata.decode(
      new Uint8Array(Buffer.from(b64, "base64")),
    );
    const get = (k: string) =>
      decoded instanceof Map ? decoded.get(k) : decoded?.[k];
    const method = get("method");
    const args = get("args");
    return {
      // Deploy transactions carry code instead of a method.
      method: typeof method === "string" && method ? method : "deploy",
      args: Array.isArray(args) ? args : [],
    };
  } catch {
    return null;
  }
}

function normalizeStudio(
  tx: StudioTx,
  contractKey: string,
  contractCategory: Category | null,
): ChainTxRow {
  const decoded = decodeStudioCalldata(tx?.data?.calldata);
  const method = decoded?.method || "-";
  const args = decoded?.args || [];
  const { disputeId, category } = deriveIds(method, args, contractCategory);

  const toAddr = (tx.to_address || "").toLowerCase();
  const known = CONTRACT_BY_ADDRESS[toAddr];

  const ts = tx.created_at ? Math.floor(Date.parse(tx.created_at) / 1000) : NaN;

  return {
    hash: tx.hash,
    method,
    disputeId,
    category,
    contractKey: known?.key || contractKey,
    contract: tx.to_address || "",
    from: tx.from_address || "",
    status: (tx.status || "").toUpperCase() || "PENDING",
    // The studio RPC doesn't report block numbers; sorting falls back to time.
    block: null,
    timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
  };
}

async function fetchFromStudioRpc(
  address: string,
  contractKey: string,
  category: Category | null,
): Promise<ChainTxRow[]> {
  const rpcUrl = getChain().rpcUrls?.default?.http?.[0];
  if (!rpcUrl) return [];
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sim_getTransactionsForAddress",
        params: [address],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const txs: StudioTx[] = Array.isArray(json?.result) ? json.result : [];
    return txs.map((t) => normalizeStudio(t, contractKey, category));
  } catch {
    return [];
  }
}

// One studio fan-out returns every transaction ever (with full consensus
// payloads - megabytes across contracts, 10-20s), so the merged result is
// cached in-process and shared by all clients. Stale hits are served
// immediately while one background fan-out refreshes the snapshot.
const STUDIO_CACHE_TTL_MS = 20_000;
let studioCache: { at: number; rows: ChainTxRow[] } | null = null;
let studioRefresh: Promise<ChainTxRow[]> | null = null;

async function studioFanOut(): Promise<ChainTxRow[]> {
  const batches = await Promise.all(
    CONTRACTS.map((c) => fetchFromStudioRpc(c.address, c.key, c.category)),
  );
  const rows = batches.flat();
  // Keep serving the previous snapshot if the RPC fan-out came back empty
  // (transient studio hiccup) rather than blanking the feed.
  if (rows.length === 0 && studioCache) return studioCache.rows;
  studioCache = { at: Date.now(), rows };
  return rows;
}

async function studioRows(): Promise<ChainTxRow[]> {
  const fresh = studioCache && Date.now() - studioCache.at < STUDIO_CACHE_TTL_MS;
  if (!studioRefresh && !fresh) {
    studioRefresh = studioFanOut().finally(() => {
      studioRefresh = null;
    });
  }
  // First call ever must wait; afterwards stale snapshots answer instantly.
  return studioCache ? studioCache.rows : studioRefresh!;
}

/* ─── Route ─── */

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit")) || 20, 1),
    50,
  );

  let rows: ChainTxRow[];
  if (EXPLORER_API_BASE) {
    // Ask each contract for a little more than the limit so the merged top-N
    // is accurate even if one contract dominates recent activity.
    const perContract = Math.min(limit, 25);
    const batches = await Promise.all(
      CONTRACTS.map((c) =>
        fetchFromExplorer(c.address, c.key, c.category, perContract),
      ),
    );
    rows = batches.flat();
  } else {
    rows = await studioRows();
  }

  // Merge, de-dupe by hash, sort by block desc (timestamp as tiebreaker).
  const seen = new Set<string>();
  const merged: ChainTxRow[] = [];
  for (const row of rows) {
    if (seen.has(row.hash)) continue;
    seen.add(row.hash);
    merged.push(row);
  }
  merged.sort((a, b) => {
    const bd = (b.block ?? 0) - (a.block ?? 0);
    if (bd !== 0) return bd;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });

  return NextResponse.json(
    { rows: merged.slice(0, limit), total: merged.length },
    {
      headers: {
        // The feed re-polls every 10s per client; a short shared cache lets
        // concurrent viewers reuse one fan-out without visible lag.
        "Cache-Control":
          "public, s-maxage=8, max-age=5, stale-while-revalidate=30",
      },
    },
  );
}
