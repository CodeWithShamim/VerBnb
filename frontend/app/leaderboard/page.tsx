"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { getRecentDisputes, subscribeRecentDisputes } from "@/lib/recentDisputes";
import {
  ADDRESS_RE,
  addManualAddress,
  fetchLeaderboard,
  getManualAddresses,
  removeManualAddress,
  subscribeManualAddresses,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import Podium from "@/components/leaderboard/Podium";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import AddAddressForm from "@/components/leaderboard/AddAddressForm";

const HAS_PRIVY = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
const MAX_ADDRESSES = 20;

// Lazy-loaded so the Privy SDK stays out of this route's initial bundle; it
// only mounts behind the HAS_PRIVY gate (Privy hooks throw without a provider).
const WalletProbe = dynamic(() => import("@/components/leaderboard/WalletProbe"), {
  ssr: false,
});

function SkeletonRows() {
  return (
    <div className="card divide-y divide-surface-border/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 w-8 animate-pulse rounded bg-surface-muted" />
          <div className="h-7 w-44 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-2 w-24 animate-pulse rounded-full bg-surface-muted" />
          <div className="ml-auto hidden h-4 w-32 animate-pulse rounded bg-surface-muted sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Rank comparator: score desc, then wins, then activity, errors last. */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.error && b.error) return a.address.localeCompare(b.address);
  if (a.error) return 1;
  if (b.error) return -1;
  if (b.credibility !== a.credibility) return b.credibility - a.credibility;
  if (b.disputesWon !== a.disputesWon) return b.disputesWon - a.disputesWon;
  if (b.disputesFiled !== a.disputesFiled) return b.disputesFiled - a.disputesFiled;
  return a.address.localeCompare(b.address);
}

export default function LeaderboardPage() {
  const [manual, setManual] = useState<string[]>([]);
  const [signers, setSigners] = useState<string[]>([]);
  const [walletAddress, setWalletAddress] = useState("");

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ---- candidate address sources (local, honest — see caption below) ----

  useEffect(() => {
    const loadManual = () => setManual(getManualAddresses());
    const loadSigners = () =>
      setSigners(
        getRecentDisputes()
          .map((d) => d.signer || "")
          .filter((s) => ADDRESS_RE.test(s)),
      );
    loadManual();
    loadSigners();
    const un1 = subscribeManualAddresses(loadManual);
    const un2 = subscribeRecentDisputes(loadSigners);
    return () => {
      un1();
      un2();
    };
  }, []);

  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const addr of [walletAddress, ...manual, ...signers]) {
      if (!ADDRESS_RE.test(addr)) continue;
      const key = addr.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(addr);
      if (out.length >= MAX_ADDRESSES) break;
    }
    return out;
  }, [walletAddress, manual, signers]);

  const candidatesKey = candidates.map((a) => a.toLowerCase()).join(",");

  // -------------------------------------------------- chain fetch + rank

  const load = useCallback(
    async (asRefresh: boolean) => {
      if (candidates.length === 0) {
        setEntries([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);
      try {
        const res = await fetchLeaderboard(candidates);
        setConfigured(res.configured);
        setEntries((res.entries || []).slice().sort(compareEntries));
      } catch (err: any) {
        setFetchError(err?.message || "Couldn't reach the leaderboard API.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatesKey],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const removable = useMemo(
    () => new Set(manual.map((a) => a.toLowerCase())),
    [manual],
  );

  const ranked = entries.filter((e) => !e.error);
  const showPodium = !loading && ranked.length >= 1;

  return (
    <div className="bg-grid min-h-screen">
      {HAS_PRIVY && <WalletProbe onAddress={setWalletAddress} />}

      <div className="container-page max-w-6xl py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-8 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="font-manrope text-3xl font-extrabold tracking-tight text-slate-900">
              Reputation Leaderboard
            </h1>
            <p className="mt-1.5 text-slate-500">
              Wallets ranked by their on-chain credibility score (0–100) from
              the reputation tracker.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Scores live on-chain per address; add any wallet to rank it.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <AddAddressForm onAdd={addManualAddress} />
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || refreshing || candidates.length === 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-surface-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              >
                <path
                  d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Refresh
            </button>
          </div>
        </motion.header>

        {/* Tracker not configured */}
        {!loading && !configured && (
          <div className="card p-8 text-center text-slate-500">
            Reputation tracker is not configured yet. Deploy the Phase 2
            contracts so their addresses land in{" "}
            <code className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs">
              deployments/bradbury.json
            </code>
            .
          </div>
        )}

        {/* API unreachable */}
        {!loading && configured && fetchError && (
          <div className="card border-rose-200 p-6 text-center text-sm text-rose-600 dark:border-rose-500/30 dark:text-rose-400">
            {fetchError}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <SkeletonRows />}

        {/* Empty state */}
        {!loading && configured && !fetchError && candidates.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="card p-12 text-center"
          >
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-subtle text-2xl">
              🏆
            </div>
            <p className="mt-4 font-semibold text-slate-700">No addresses yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
              Connect a wallet, file a dispute, or add any address above to see
              its on-chain credibility ranked here.
            </p>
          </motion.div>
        )}

        {/* Podium + table */}
        {!loading && configured && !fetchError && entries.length > 0 && (
          <div className="space-y-6">
            {showPodium && (
              <Podium entries={ranked} connectedAddress={walletAddress} />
            )}
            <LeaderboardTable
              entries={entries}
              connectedAddress={walletAddress}
              removable={removable}
              onRemove={removeManualAddress}
            />
            <p className="text-center text-xs text-slate-400">
              Credibility = win rate ×50 + validator accuracy ×40 + appeal
              success ×10, computed by the reputation tracker contract.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
