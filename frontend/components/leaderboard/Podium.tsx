"use client";

import { motion } from "framer-motion";
import CopyAddress from "@/components/CopyAddress";
import TrustScoreBadge from "@/components/TrustScoreBadge";
import type { LeaderboardEntry } from "@/lib/leaderboard";

const MEDALS = [
  {
    label: "1st",
    emoji: "🥇",
    ring: "border-amber-300 dark:border-amber-400/40",
    glow: "from-amber-100/80 to-transparent dark:from-amber-400/10",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  {
    label: "2nd",
    emoji: "🥈",
    ring: "border-slate-300 dark:border-slate-400/40",
    glow: "from-slate-100/80 to-transparent dark:from-slate-400/10",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300",
  },
  {
    label: "3rd",
    emoji: "🥉",
    ring: "border-orange-300 dark:border-orange-400/40",
    glow: "from-orange-100/80 to-transparent dark:from-orange-400/10",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
];

/**
 * Medal cards for the top-3 ranked addresses. Expects `entries` already
 * sorted by credibility (index 0 = rank 1); renders nothing past index 2.
 */
export default function Podium({
  entries,
  connectedAddress,
}: {
  entries: LeaderboardEntry[];
  connectedAddress?: string;
}) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {top.map((entry, i) => {
        const medal = MEDALS[i];
        const isYou =
          !!connectedAddress &&
          entry.address.toLowerCase() === connectedAddress.toLowerCase();
        return (
          <motion.div
            key={entry.address.toLowerCase()}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.08, ease: "easeOut" }}
            className={`card relative overflow-hidden border-2 p-5 ${medal.ring}`}
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${medal.glow}`}
            />
            <div className="relative flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${medal.chip}`}
              >
                <span aria-hidden>{medal.emoji}</span> {medal.label}
              </span>
              {isYou && (
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                  You
                </span>
              )}
            </div>

            <div className="relative mt-4">
              <TrustScoreBadge score={entry.credibility} />
            </div>

            <div className="relative mt-4">
              <CopyAddress value={entry.address} truncate />
            </div>

            <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface-subtle px-2 py-2">
                <p className="text-sm font-bold text-slate-900">
                  {entry.disputesFiled}
                </p>
                <p className="text-[11px] text-slate-400">Filed</p>
              </div>
              <div className="rounded-lg bg-surface-subtle px-2 py-2">
                <p className="text-sm font-bold text-slate-900">
                  {entry.disputesWon}
                </p>
                <p className="text-[11px] text-slate-400">Won</p>
              </div>
              <div className="rounded-lg bg-surface-subtle px-2 py-2">
                <p className="text-sm font-bold text-slate-900">
                  {entry.winRate == null ? "—" : `${entry.winRate}%`}
                </p>
                <p className="text-[11px] text-slate-400">Win rate</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
