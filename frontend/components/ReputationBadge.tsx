"use client";

import { useEffect, useState } from "react";

type Size = "small" | "medium" | "large";

interface RepStats {
  overall_score: number;
  disputes_filed: number;
  disputes_won?: number;
  disputes_lost?: number;
  exists?: boolean;
}

const SIZES: Record<Size, { box: string; text: string; ring: number }> = {
  small: { box: "h-9 w-9", text: "text-xs", ring: 3 },
  medium: { box: "h-14 w-14", text: "text-base", ring: 5 },
  large: { box: "h-20 w-20", text: "text-2xl", ring: 6 },
};

function tone(score: number) {
  if (score >= 70)
    return { stroke: "stroke-emerald-500", text: "text-emerald-600", label: "High Trust" };
  if (score >= 40)
    return { stroke: "stroke-amber-500", text: "text-amber-600", label: "Medium" };
  return { stroke: "stroke-rose-500", text: "text-rose-500", label: "Low" };
}

/**
 * Reusable reputation badge. Fetches reputation_tracker.get_reputation(address)
 * via /api/trackers and renders a color-coded score circle with a hover card.
 *
 * Props:
 *   address  - the user address to score
 *   size     - small | medium | large
 *   showLabel- render the textual trust label next to the circle (default true)
 */
export default function ReputationBadge({
  address,
  size = "medium",
  showLabel = true,
}: {
  address: string;
  size?: Size;
  showLabel?: boolean;
}) {
  const [stats, setStats] = useState<RepStats | null>(null);
  const dims = SIZES[size];

  useEffect(() => {
    let alive = true;
    if (!address) return;
    fetch(`/api/trackers?resource=reputation&address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d && typeof d.overall_score === "number") setStats(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address]);

  const score = stats?.overall_score ?? 0;
  const t = tone(score);
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;

  return (
    <div className="group relative inline-flex items-center gap-2">
      <div className={`relative ${dims.box}`}>
        <svg viewBox="0 0 40 40" className={`${dims.box} -rotate-90`}>
          <circle
            cx="20"
            cy="20"
            r={r}
            className="fill-none stroke-surface-muted"
            strokeWidth={dims.ring}
          />
          <circle
            cx="20"
            cy="20"
            r={r}
            className={`fill-none ${t.stroke}`}
            strokeWidth={dims.ring}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - dash}
          />
        </svg>
        <span
          className={`absolute inset-0 grid place-items-center font-extrabold ${dims.text} ${t.text}`}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <span className={`text-sm font-semibold ${t.text}`}>{t.label}</span>
      )}

      {/* Hover detail card */}
      {stats && (
        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-52 rounded-xl border border-surface-border bg-white p-3 text-xs shadow-lg group-hover:block">
          <p className="font-semibold text-slate-700">Reputation {score}/100</p>
          <div className="mt-2 space-y-1 text-slate-500">
            <div className="flex justify-between">
              <span>Disputes filed</span>
              <span className="font-medium text-slate-700">{stats.disputes_filed ?? 0}</span>
            </div>
            {typeof stats.disputes_won === "number" && (
              <div className="flex justify-between">
                <span>Won / Lost</span>
                <span className="font-medium text-slate-700">
                  {stats.disputes_won}/{stats.disputes_lost ?? 0}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Trust tier</span>
              <span className={`font-medium ${t.text}`}>{t.label}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
