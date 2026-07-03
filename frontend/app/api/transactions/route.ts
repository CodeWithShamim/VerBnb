import { NextRequest, NextResponse } from "next/server";
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
// Fans out to the GenLayer explorer API (one call per contract), decodes each
// transaction's method + dispute id from its base64 calldata, merges, and
// returns the latest N sorted by block. Status and block are whatever the
// explorer reports right now — nothing is cached server-side.

const VALID_CATEGORIES = new Set(Object.keys(CATEGORIES));

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

/** Decode { method, args } from a transaction's base64 calldata. */
function decodeCalldata(tx: ExplorerTx): { method: string; args: any[] } | null {
  const c = tx?.data?.params?.encoded_data?.calldata;
  if (c?.encoding === "base64" && c.content) {
    try {
      const parsed = JSON.parse(Buffer.from(c.content, "base64").toString());
      if (parsed && typeof parsed === "object") {
        return { method: parsed.method || tx?.data?.function || "—", args: parsed.args || [] };
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

function normalize(
  tx: ExplorerTx,
  contractKey: string,
  contractCategory: Category | null
): ChainTxRow {
  const decoded = decodeCalldata(tx);
  const method = decoded?.method || tx?.data?.function || "—";
  const args = decoded?.args || [];

  // args[0] is the dispute id for raise_dispute / register_dispute /
  // validate_claim / mark_resolved. For register_dispute, args[1] is the
  // category — a stronger signal than the contract (the registry handles all
  // categories).
  const idMethods = new Set([
    "raise_dispute",
    "register_dispute",
    "validate_claim",
    "mark_resolved",
  ]);
  const disputeId =
    idMethods.has(method) && typeof args[0] === "string" ? args[0] : null;

  let category: Category | null = contractCategory;
  if (method === "register_dispute" && typeof args[1] === "string") {
    const cat = args[1].toUpperCase();
    if (VALID_CATEGORIES.has(cat)) category = cat as Category;
  }

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

async function fetchForContract(
  address: string,
  contractKey: string,
  category: Category | null,
  pageSize: number
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
    return txs.map((t) => normalize(t, contractKey, category));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit")) || 20, 1),
    50
  );

  // Ask each contract for a little more than the limit so the merged top-N is
  // accurate even if one contract dominates recent activity.
  const perContract = Math.min(limit, 25);

  const batches = await Promise.all(
    CONTRACTS.map((c) =>
      fetchForContract(c.address, c.key, c.category, perContract)
    )
  );

  // Merge, de-dupe by hash, sort by block desc (timestamp as tiebreaker).
  const seen = new Set<string>();
  const merged: ChainTxRow[] = [];
  for (const row of batches.flat()) {
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
        // concurrent viewers reuse one explorer fan-out without visible lag.
        "Cache-Control": "public, s-maxage=8, max-age=5, stale-while-revalidate=30",
      },
    }
  );
}
