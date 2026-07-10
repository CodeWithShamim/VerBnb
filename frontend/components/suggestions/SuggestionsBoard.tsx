"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { suggestionsFetch } from "@/lib/suggestionsClient";
import { RevealGroup } from "../Reveal";
import SuggestionCard, { type SuggestedProduct } from "./SuggestionCard";

interface Suggestions {
  topic: string;
  products: SuggestedProduct[];
  summary: string;
  source_url: string;
  source_host: string;
  checked_at: string;
}

type TopicsState =
  | { phase: "loading" }
  | { phase: "unconfigured" }
  | { phase: "ready"; topics: string[] };

/** "wireless-earbuds" / "wireless_earbuds" -> "Wireless Earbuds". */
function prettyTopic(key: string): string {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** ISO string -> short local date-time, or "" when unparseable. */
function fmtCheckedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SkeletonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card p-6">
          <div className="h-10 w-10 rounded-xl bg-surface-muted shimmer" />
          <div className="mt-4 h-5 w-3/4 rounded-md bg-surface-muted shimmer" />
          <div className="mt-3 h-3 w-1/2 rounded-md bg-surface-muted shimmer" />
          <div className="mt-4 h-3 w-full rounded-md bg-surface-muted shimmer" />
          <div className="mt-2 h-3 w-5/6 rounded-md bg-surface-muted shimmer" />
        </div>
      ))}
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card mx-auto max-w-lg p-10 text-center"
    >
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-soft">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-6 w-6"
        >
          <path
            d="M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
    </motion.div>
  );
}

/**
 * Validator-curated product picks from the product_suggester contract.
 * Loads the curated topic list, then the up-to-5 picks for the selected
 * topic - with provenance (source link + checked_at) under the grid.
 */
export default function SuggestionsBoard() {
  const [topicsState, setTopicsState] = useState<TopicsState>({
    phase: "loading",
  });
  const [topic, setTopic] = useState<string>("");
  const [data, setData] = useState<Suggestions | null>(null);
  const [loadingPicks, setLoadingPicks] = useState(false);

  // Load the curated topic list once.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await suggestionsFetch("topics");
        if (cancelled) return;
        if (res?.configured === false) {
          setTopicsState({ phase: "unconfigured" });
          return;
        }
        const topics: string[] = Array.isArray(res?.topics) ? res.topics : [];
        setTopicsState({ phase: "ready", topics });
        if (topics.length > 0) setTopic(topics[0]);
      } catch {
        if (!cancelled) setTopicsState({ phase: "ready", topics: [] });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load picks for the selected topic.
  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    setLoadingPicks(true);
    setData(null);
    suggestionsFetch("suggestions", { topic })
      .then((res) => {
        if (cancelled) return;
        if (res && Array.isArray(res.products)) setData(res);
      })
      .catch(() => {
        /* keep null - renders the "nothing curated" note */
      })
      .finally(() => {
        if (!cancelled) setLoadingPicks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topic]);

  if (topicsState.phase === "loading") {
    return (
      <div>
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-full bg-surface-muted shimmer"
            />
          ))}
        </div>
        <SkeletonCards />
      </div>
    );
  }

  if (topicsState.phase === "unconfigured") {
    return (
      <EmptyCard
        title="Suggestions engine not deployed yet"
        body="The product_suggester contract isn't on-chain yet. Deploy it and the validator-curated picks appear here - no frontend changes needed."
      />
    );
  }

  if (topicsState.topics.length === 0) {
    return (
      <EmptyCard
        title="No curated topics yet"
        body="refresh_suggestions hasn't been called. Once a topic is curated on-chain, its top picks land here."
      />
    );
  }

  const checkedAt = data ? fmtCheckedAt(data.checked_at) : "";

  return (
    <div>
      {/* Topic pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {topicsState.topics.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            className={`rounded-full px-4 py-1.5 font-manrope text-sm font-medium transition-colors ${
              topic === t
                ? "bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-soft"
                : "bg-surface-subtle text-slate-600 hover:bg-surface-muted"
            }`}
          >
            {prettyTopic(t)}
          </button>
        ))}
      </div>

      {loadingPicks && <SkeletonCards />}

      {!loadingPicks && data && data.products.length > 0 && (
        <>
          {data.summary && (
            <p className="mb-6 max-w-2xl text-sm leading-relaxed text-slate-500">
              {data.summary}
            </p>
          )}

          <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((p, i) => (
              <SuggestionCard key={`${p.name}-${i}`} product={p} rank={i + 1} />
            ))}
          </RevealGroup>

          {/* Provenance - where and when validators checked. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            {checkedAt && <span>Checked {checkedAt}</span>}
            {data.source_host && (
              <>
                <span aria-hidden>·</span>
                {data.source_url ? (
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-cyan-600 transition-opacity hover:opacity-80 dark:text-cyan-400"
                  >
                    Source: {data.source_host}
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                      <path
                        d="M7 17 17 7M9 7h8v8"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                ) : (
                  <span>Source: {data.source_host}</span>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!loadingPicks && (!data || data.products.length === 0) && (
        <EmptyCard
          title={`Nothing curated for ${prettyTopic(topic)} yet`}
          body="Validators haven't published picks for this topic. Call refresh_suggestions to fetch and verify the latest recommendations."
        />
      )}
    </div>
  );
}
