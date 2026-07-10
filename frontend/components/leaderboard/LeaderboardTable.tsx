"use client";

import { motion } from "framer-motion";
import CopyAddress from "@/components/CopyAddress";
import type { LeaderboardEntry } from "@/lib/leaderboard";

function scoreTone(score: number) {
  if (score >= 70) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (score >= 40) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-rose-500", text: "text-rose-500" };
}

function RankCell({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
      {medal && <span aria-hidden>{medal}</span>}
      <span className={medal ? "text-slate-400" : ""}>#{rank}</span>
    </span>
  );
}

/**
 * Ranked table below the podium. `entries` must already be sorted (rank =
 * index + 1); error rows (entry.error set) render a degraded state. Rows whose
 * address is in `removable` show a remove (×) control.
 */
export default function LeaderboardTable({
  entries,
  connectedAddress,
  removable,
  onRemove,
}: {
  entries: LeaderboardEntry[];
  connectedAddress?: string;
  /** Lower-cased addresses that were manually added (thus removable). */
  removable: Set<string>;
  onRemove: (address: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 font-semibold">Rank</th>
            <th className="px-4 py-3 font-semibold">Address</th>
            <th className="px-4 py-3 font-semibold">Credibility</th>
            <th className="px-4 py-3 text-center font-semibold">Filed</th>
            <th className="px-4 py-3 text-center font-semibold">Won</th>
            <th className="px-4 py-3 text-center font-semibold">Win rate</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const lower = entry.address.toLowerCase();
            const isYou =
              !!connectedAddress && lower === connectedAddress.toLowerCase();
            const canRemove = removable.has(lower);

            if (entry.error) {
              return (
                <motion.tr
                  key={lower}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
                  className="border-b border-surface-border/60 last:border-0"
                >
                  <td className="px-4 py-3 text-slate-300">—</td>
                  <td className="px-4 py-3">
                    <CopyAddress value={entry.address} truncate explorer={false} />
                  </td>
                  <td className="px-4 py-3" colSpan={4}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Read failed — try refresh
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canRemove && (
                      <RemoveButton onClick={() => onRemove(entry.address)} />
                    )}
                  </td>
                </motion.tr>
              );
            }

            const tone = scoreTone(entry.credibility);
            return (
              <motion.tr
                key={lower}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
                className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-subtle/60"
              >
                <td className="px-4 py-3">
                  <RankCell rank={i + 1} />
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <CopyAddress value={entry.address} truncate />
                    {isYou && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        You
                      </span>
                    )}
                    {!entry.exists && (
                      <span
                        className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-slate-400"
                        title="No on-chain reputation recorded yet"
                      >
                        New
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-7 text-right font-bold tabular-nums ${tone.text}`}>
                      {entry.credibility}
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${entry.credibility}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`h-full rounded-full ${tone.bar}`}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                  {entry.disputesFiled}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                  {entry.disputesWon}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                  {entry.winRate == null ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    `${entry.winRate}%`
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canRemove && (
                    <RemoveButton onClick={() => onRemove(entry.address)} />
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Remove from leaderboard"
      aria-label="Remove address"
      className="inline-grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
    >
      ×
    </button>
  );
}
