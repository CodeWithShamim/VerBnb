"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRecentDisputes,
  subscribeRecentDisputes,
  type RecentDispute,
} from "@/lib/recentDisputes";
import DisputeGrid from "./DisputeGrid";
import type { ExplorerDispute } from "./DisputeCard";
import type { CategoryFilter, StatusFilter } from "./FilterBar";

/** Tx statuses the chain reports as settled (no more polling needed). */
const SETTLED = new Set(["FINALIZED", "ACCEPTED"]);

/** Re-poll cadence while any local dispute is still unresolved. */
const POLL_MS = 15_000;

function titleCase(s: string): string {
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "";
}

/**
 * Disputes submitted from this browser (localStorage ledger), enriched
 * straight from the chain: registry record + specialist verdict via
 * /api/explorer?dispute= (RPC reads — works on every network, including ones
 * without an explorer API like studionet) and the submission tx's live status
 * via /api/tx. Unresolved entries re-poll while the tab is visible; resolved
 * records and settled tx statuses are terminal and cached.
 */
export default function LocalDisputes({
  category,
  status,
}: {
  category: CategoryFilter;
  status: StatusFilter;
}) {
  const [local, setLocal] = useState<RecentDispute[]>([]);
  const [chain, setChain] = useState<Map<string, ExplorerDispute>>(new Map());
  const [txStatus, setTxStatus] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);

  // Latest enrichment maps, readable from inside load() without re-creating
  // the callback (which would reset the polling interval) on every fetch.
  const chainRef = useRef(chain);
  chainRef.current = chain;
  const txRef = useRef(txStatus);
  txRef.current = txStatus;

  // localStorage ledger — updates live when a dispute is submitted in-tab.
  useEffect(() => {
    const refresh = () => setLocal(getRecentDisputes());
    refresh();
    return subscribeRecentDisputes(refresh);
  }, []);

  const load = useCallback(async () => {
    const list = getRecentDisputes();
    if (list.length === 0) {
      setReady(true);
      return;
    }

    // Registry record + verdict, skipping disputes already known resolved.
    const recordJobs = list
      .filter((d) => !chainRef.current.get(d.id)?.resolved)
      .map(async (d) => {
        const res = await fetch(
          `/api/explorer?dispute=${encodeURIComponent(d.id)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        const rec = Array.isArray(data?.records) ? data.records[0] : null;
        return [d.id, (rec as ExplorerDispute) ?? null] as const;
      });

    // Live tx status for the specialist submission hash, until it settles.
    const txJobs = list
      .filter(
        (d) => d.tx && !SETTLED.has((txRef.current.get(d.id) || "").toUpperCase())
      )
      .map(async (d) => {
        const res = await fetch(`/api/tx?hash=${encodeURIComponent(d.tx!)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        return [d.id, String(data?.status || "")] as const;
      });

    const [recResults, txResults] = await Promise.all([
      Promise.allSettled(recordJobs),
      Promise.allSettled(txJobs),
    ]);

    setChain((prev) => {
      const next = new Map(prev);
      for (const r of recResults) {
        if (r.status === "fulfilled" && r.value[1]) next.set(r.value[0], r.value[1]);
      }
      return next;
    });
    setTxStatus((prev) => {
      const next = new Map(prev);
      for (const r of txResults) {
        if (r.status === "fulfilled" && r.value[1]) next.set(r.value[0], r.value[1]);
      }
      return next;
    });
    setReady(true);
  }, []);

  // Fetch on mount / ledger change, then re-poll while the tab is visible so
  // "Pending" flips to "Resolved" without a manual refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      load();
      timer = setInterval(load, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [load, local.length]);

  if (local.length === 0) return null;

  const records: ExplorerDispute[] = local.map((d) => {
    const rec = chain.get(d.id) ?? null;
    const resolved = rec?.resolved ?? false;
    const tx = txStatus.get(d.id);
    return {
      id: d.id,
      category: rec?.category || d.category,
      status: resolved ? "RESOLVED" : "PENDING",
      resolved,
      submitter: rec?.submitter || d.signer || "",
      timestamp: rec?.timestamp ?? Math.floor(d.submittedAt / 1000),
      refundPct: rec?.refundPct ?? null,
      summary: rec?.summary ?? null,
      txStatus: tx ? titleCase(tx) : null,
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
