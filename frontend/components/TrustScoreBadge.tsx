"use client";

import { motion } from "framer-motion";

export default function TrustScoreBadge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 70
      ? {
          ring: "stroke-emerald-500",
          text: "text-emerald-600",
          label: "Trusted",
        }
      : clamped >= 40
      ? { ring: "stroke-amber-500", text: "text-amber-600", label: "Mixed" }
      : { ring: "stroke-rose-500", text: "text-rose-500", label: "Low trust" };

  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-subtle p-4">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={r}
            className="fill-none stroke-surface-muted"
            strokeWidth={6}
          />
          <motion.circle
            cx="32"
            cy="32"
            r={r}
            className={`fill-none ${tone.ring}`}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - dash }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <span
          className={`absolute inset-0 grid place-items-center text-xl font-extrabold ${tone.text}`}
        >
          {clamped}
        </span>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Trust score
        </p>
        <p className={`mt-0.5 text-base font-bold ${tone.text}`}>{tone.label}</p>
      </div>
    </div>
  );
}
