"use client";

import { motion } from "framer-motion";
import { CATEGORIES, type Category } from "@/lib/contracts";

/** Shape of one match from analytics_tracker.get_similar_disputes. */
export interface ComparableCase {
  dispute_id: string;
  verdict: string; // FAVORABLE | UNFAVORABLE
  refund_percentage: number;
  required_appeals: number;
  match_score: number;
  claim_snippet: string;
}

/** Per-category historical stats from analytics_tracker.get_category_stats. */
export interface CategoryStats {
  category: string;
  total_disputes: number;
  favorable_verdicts: number;
  unfavorable: number;
  avg_refund_pct: number;
  avg_resolution_time: number; // seconds
  consensus_rate: number; // %
  last_updated: number;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * "Similar resolved disputes" for the simulator: each keyword-matched past
 * case with its verdict + awarded refund %, a computed settle range, and the
 * category's historical averages. Empty state covers a fresh testnet.
 */
export default function ComparableCases({
  category,
  cases,
  matchCount,
  stats,
}: {
  category: Category;
  cases: ComparableCase[];
  matchCount: number;
  stats: CategoryStats | null;
}) {
  const meta = CATEGORIES[category];
  const refunds = cases.map((c) => c.refund_percentage);
  const lo = refunds.length ? Math.min(...refunds) : 0;
  const hi = refunds.length ? Math.max(...refunds) : 0;
  const maxMatch = Math.max(1, ...cases.map((c) => c.match_score));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Similar resolved disputes
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.soft} ${meta.text} dark:bg-surface-muted`}>
          {matchCount} match{matchCount === 1 ? "" : "es"} in {meta.title}
        </span>
      </div>

      {cases.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-surface-border bg-surface-subtle px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-500">
            No comparable cases yet on this testnet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Your dispute would be one of the first of its kind in the{" "}
            {meta.title.toLowerCase()} category - outcomes below reflect the
            category average only.
          </p>
        </div>
      ) : (
        <>
          {/* Computed settle range */}
          <div className="mt-3 rounded-xl border border-surface-border bg-surface-subtle px-4 py-3">
            <p className="text-sm text-slate-600">
              Comparable cases settled between{" "}
              <span className="font-mono font-bold tabular-nums text-slate-900">{lo}%</span>
              {" "}and{" "}
              <span className="font-mono font-bold tabular-nums text-slate-900">{hi}%</span>{" "}
              refund.
            </p>
            {/* range bar */}
            <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`absolute inset-y-0 rounded-full bg-gradient-to-r ${meta.gradient} opacity-70`}
                style={{
                  left: `${lo}%`,
                  width: `${Math.max(2, hi - lo)}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-slate-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Case list */}
          <ul className="mt-3 space-y-2.5">
            {cases.map((c, i) => (
              <motion.li
                key={c.dispute_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.35 }}
                className="rounded-xl border border-surface-border bg-surface p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      c.verdict === "FAVORABLE"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                        : "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                    }`}
                  >
                    {c.verdict}
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums text-slate-900">
                    {c.refund_percentage}%
                  </span>
                  <span className="text-xs text-slate-400">refund</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
                    {c.required_appeals > 0
                      ? `${c.required_appeals} appeal${c.required_appeals === 1 ? "" : "s"}`
                      : "first-round consensus"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  “{c.claim_snippet}”
                </p>
                {/* keyword-overlap meter */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`}
                      style={{ width: `${(c.match_score / maxMatch) * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">
                    {c.match_score} keyword{c.match_score === 1 ? "" : "s"} in common
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}

      {/* Category historical averages */}
      {stats && stats.total_disputes > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            { label: "Avg refund", value: `${stats.avg_refund_pct}%` },
            { label: "Cases resolved", value: String(stats.total_disputes) },
            { label: "Avg resolution", value: formatDuration(stats.avg_resolution_time) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-surface-border bg-surface-subtle px-3 py-2.5 text-center"
            >
              <div className="font-mono text-base font-bold tabular-nums text-slate-900">
                {s.value}
              </div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
