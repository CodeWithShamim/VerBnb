"use client";

import { motion } from "framer-motion";
import { TIER_META, type ClaimStrengthResult } from "@/lib/claimStrength";

/** Tier → Tailwind classes (literals live here so the JIT scanner sees them). */
const TIER_CLASSES: Record<
  ClaimStrengthResult["tier"],
  { text: string; chip: string }
> = {
  weak: { text: "text-rose-500", chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/10" },
  fair: { text: "text-amber-500", chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10" },
  strong: {
    text: "text-emerald-500",
    chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  },
};

const R = 52; // ring radius
const CIRC = 2 * Math.PI * R;

/**
 * Claim-strength result: an animated score ring colored by tier, plus the
 * transparent breakdown checklist with tips wherever points were missed.
 */
export default function StrengthGauge({ result }: { result: ClaimStrengthResult }) {
  const tier = TIER_META[result.tier];
  const cls = TIER_CLASSES[result.tier];
  const filled = (result.score / 100) * CIRC;

  return (
    <div>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        {/* Score ring */}
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-surface-muted"
            />
            <motion.circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              stroke={tier.hex}
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: CIRC - filled }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <motion.div
                key={result.score}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className={`font-mono text-3xl font-bold tabular-nums ${cls.text}`}
              >
                {result.score}
              </motion.div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                / 100
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${cls.chip}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tier.hex }}
            />
            {tier.label} claim
          </span>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {result.tier === "strong" &&
              "Well-structured and evidence-backed. Validators will have concrete facts to verify."}
            {result.tier === "fair" &&
              "A reasonable start - tightening the gaps below would give validators more to verify."}
            {result.tier === "weak" &&
              "Too thin to verify as-is. Work through the tips below before spending gas."}
          </p>
        </div>
      </div>

      {/* Breakdown checklist */}
      <ul className="mt-6 space-y-2.5">
        {result.breakdown.map((item, i) => {
          const full = item.points >= item.max;
          const none = item.points === 0;
          return (
            <motion.li
              key={item.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.35 }}
              className="rounded-xl border border-surface-border bg-surface-subtle px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    full
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                      : none
                        ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                        : "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
                  }`}
                >
                  {full ? "✓" : none ? "✕" : "±"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  {item.label}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-500">
                  {item.points}/{item.max}
                </span>
              </div>
              {item.tip && (
                <p className="mt-1.5 pl-[30px] text-xs leading-relaxed text-slate-400">
                  {item.tip}
                </p>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
