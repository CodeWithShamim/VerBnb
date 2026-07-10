"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import MeshBackground from "@/components/MeshBackground";
import Reveal from "@/components/Reveal";
import ExplorerStats from "@/components/explorer/ExplorerStats";
import FilterBar, {
  type CategoryFilter,
  type StatusFilter,
} from "@/components/explorer/FilterBar";
import DisputeGrid from "@/components/explorer/DisputeGrid";
import LocalDisputes from "@/components/explorer/LocalDisputes";
import type { ExplorerDispute } from "@/components/explorer/DisputeCard";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type SearchState =
  | { phase: "idle" }
  | { phase: "loading"; query: string }
  | { phase: "error"; query: string; message: string }
  | {
      phase: "done";
      query: string;
      mode: "dispute" | "address";
      records: ExplorerDispute[];
    };

export default function ExplorerPage() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState<SearchState>({ phase: "idle" });
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const isAddress = ADDRESS_RE.test(input.trim());

  const runSearch = useCallback(async (raw: string) => {
    const query = raw.trim();
    if (!query) return;
    setSearch({ phase: "loading", query });
    try {
      const param = ADDRESS_RE.test(query)
        ? `address=${encodeURIComponent(query)}`
        : `dispute=${encodeURIComponent(query)}`;
      const res = await fetch(`/api/explorer?${param}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setSearch({
          phase: "error",
          query,
          message: data?.error || "The chain didn't respond. Try again.",
        });
        return;
      }
      setSearch({
        phase: "done",
        query,
        mode: data.mode === "address" ? "address" : "dispute",
        records: Array.isArray(data.records) ? data.records : [],
      });
    } catch {
      setSearch({
        phase: "error",
        query,
        message: "Network error while reaching the chain. Try again.",
      });
    }
  }, []);

  const filtered = useMemo(() => {
    if (search.phase !== "done") return [];
    return search.records.filter(
      (r) =>
        (category === "ALL" || r.category === category) &&
        (status === "ALL" || r.status === status)
    );
  }, [search, category, status]);

  return (
    <div className="bg-grid min-h-screen font-manrope">
      {/* ─── Header ─── */}
      <section className="relative overflow-hidden">
        <MeshBackground />
        <div className="container-page relative z-10 max-w-4xl pb-10 pt-16 text-center sm:pt-20">
          <Reveal direction="down">
            <span className="chip mx-auto bg-white/70 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Public on-chain records
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Dispute <span className="gradient-text">Explorer</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              Every dispute and AI verdict on VerBnb lives on-chain. Look up
              any dispute id or wallet address and read the record straight
              from the GenLayer registry.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="container-page max-w-5xl pb-20">
        {/* ─── Stats strip ─── */}
        <Reveal>
          <div className="mb-8">
            <ExplorerStats />
          </div>
        </Reveal>

        {/* ─── Search ─── */}
        <Reveal delay={0.05}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(input);
            }}
            className="card p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search a dispute id (e.g. rental-…) or a 0x wallet address"
                spellCheck={false}
                className="input flex-1 font-mono"
              />
              <button
                type="submit"
                disabled={!input.trim() || search.phase === "loading"}
                className="btn-primary shrink-0 px-6 py-3 text-sm"
              >
                {search.phase === "loading" ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {input.trim()
                ? isAddress
                  ? "Wallet address detected — fetching every dispute this wallet submitted (latest 25)."
                  : "Dispute id — fetching the registry record and its verdict."
                : "Search covers any dispute or wallet on-chain, not just ones from this browser."}
            </p>
          </form>
        </Reveal>

        {/* ─── Filters ─── */}
        <Reveal delay={0.1}>
          <div className="mt-6">
            <FilterBar
              category={category}
              onCategory={setCategory}
              status={status}
              onStatus={setStatus}
            />
          </div>
        </Reveal>

        {/* ─── Search results ─── */}
        <div className="mt-6">
          {search.phase === "loading" && (
            <div className="card flex items-center justify-center gap-3 p-12">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="text-sm text-slate-500">
                Reading the registry on GenLayer…
              </span>
            </div>
          )}

          {search.phase === "error" && (
            <div className="card p-10 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Couldn&apos;t reach the chain
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                {search.message}
              </p>
              <button
                type="button"
                onClick={() => runSearch(search.query)}
                className="btn-primary mt-5 px-5 py-2.5 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {search.phase === "done" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {search.mode === "address"
                    ? "Disputes by wallet"
                    : "Search result"}
                </h2>
                <span className="truncate font-mono text-xs text-slate-400">
                  {search.query}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="card p-10 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    No disputes found
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                    {search.records.length > 0
                      ? "Results exist but none match the current filters — try All."
                      : search.mode === "address"
                        ? "This wallet hasn't submitted any disputes to the registry."
                        : "No dispute with this id is registered on-chain. Check the id, or search by the submitting wallet."}
                  </p>
                </div>
              ) : (
                <DisputeGrid records={filtered} />
              )}
            </motion.section>
          )}
        </div>

        {/* ─── Locally-submitted disputes ─── */}
        <div className="mt-12">
          <LocalDisputes category={category} status={status} />
        </div>
      </div>
    </div>
  );
}
