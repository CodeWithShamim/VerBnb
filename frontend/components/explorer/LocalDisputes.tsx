"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getRecentDisputes,
  subscribeRecentDisputes,
  type RecentDispute,
} from "@/lib/recentDisputes";
import type { ChainTxRow } from "@/lib/contracts";
import DisputeGrid from "./DisputeGrid";
import type { ExplorerDispute } from "./DisputeCard";
import type { CategoryFilter, StatusFilter } from "./FilterBar";

/** Statuses the chain reports as settled for a transaction. */
const SETTLED = new Set(["FINALIZED", "ACCEPTED"]);

function titleCase(s: string): string {
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "";
}

/**
 * Disputes submitted from this browser (localStorage ledger), enriched
 * straight from the chain via the existing /api/transactions feed: live tx
 * status, block timestamp, and a resolved flag when a finalized
 * mark_resolved transaction exists for the id.
 */
export default function LocalDisputes({
  category,
  status,
}: {
  category: CategoryFilter;
  status: StatusFilter;
}) {
  const [local, setLocal] = useState<RecentDispute[]>([]);
  const [rows, setRows] = useState<ChainTxRow[]>([]);
  const [ready, setReady] = useState(false);

  // localStorage ledger — updates live when a dispute is submitted in-tab.
  useEffect(() => {
    const refresh = () => setLocal(getRecentDisputes());
    refresh();
    return subscribeRecentDisputes(refresh);
  }, []);

  const loadChain = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions?limit=50", {
        cache: "no-store",
      });
      const data = await res.json();
      if (Array.isArray(data?.rows)) setRows(data.rows);
    } catch {
      /* enrichment is best-effort; cards fall back to local data */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadChain();
  }, [loadChain]);

  if (local.length === 0) return null;

  // disputeId → { latest tx status/timestamp, resolved via mark_resolved }.
  const byId = new Map<
    string,
    { status: string; timestamp: number | null; from: string; resolved: boolean }
  >();
  for (const row of rows) {
    if (!row.disputeId) continue;
    const prev = byId.get(row.disputeId);
    const resolved =
      (prev?.resolved ?? false) ||
      (row.method === "mark_resolved" && SETTLED.has(row.status));
    if (!prev) {
      byId.set(row.disputeId, {
        status: row.status,
        timestamp: row.timestamp,
        from: row.from,
        resolved,
      });
    } else {
      // Feed is block-desc; the first row seen is the latest. Only merge the
      // resolved flag from older rows.
      prev.resolved = resolved;
    }
  }

  const records: ExplorerDispute[] = local.map((d) => {
    const chain = byId.get(d.id);
    const resolved = chain?.resolved ?? false;
    return {
      id: d.id,
      category: d.category,
      status: resolved ? "RESOLVED" : "PENDING",
      resolved,
      submitter: d.signer || chain?.from || "",
      timestamp: chain?.timestamp ?? Math.floor(d.submittedAt / 1000),
      refundPct: null,
      summary: null,
      txStatus: chain ? titleCase(chain.status) : null,
    };
  });

  const filtered = records.filter(
    (r) =>
      (category === "ALL" || r.category === category) &&
      (status === "ALL" || r.status === status)
  );

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Disputes from this browser
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-400">
          The registry doesn&apos;t expose a global list of disputes, so this
          section shows the ones submitted from this browser — enriched live
          from the chain. Use the search above to look up any dispute id or
          wallet on-chain.
        </p>
      </div>

      {!ready ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(local.length, 3) }).map((_, i) => (
            <div key={i} className="h-[132px] rounded-2xl bg-surface-muted shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          No locally-submitted disputes match the current filters.
        </div>
      ) : (
        <DisputeGrid records={filtered} />
      )}
    </section>
  );
}
