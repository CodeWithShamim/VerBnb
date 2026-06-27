"use client";

import { useEffect, useState } from "react";

interface Flag {
  flag_id: string;
  flag_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | string;
  confidence: number;
  evidence?: Record<string, any>;
}

const SEVERITY_TONE: Record<string, string> = {
  HIGH: "border-rose-300 bg-rose-50 text-rose-700",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-700",
  LOW: "border-yellow-200 bg-yellow-50 text-yellow-700",
};

/**
 * Renders fraud flags for an address (fraud_detector.get_fraud_flags).
 * Returns null when the address has no active flags, so it's safe to drop into
 * any card without reserving space.
 */
export default function FraudAlert({ address }: { address: string }) {
  const [flags, setFlags] = useState<Flag[]>([]);

  useEffect(() => {
    let alive = true;
    if (!address) return;
    fetch(`/api/trackers?resource=fraud_flags&address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.flags)) setFlags(d.flags);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address]);

  if (!flags.length) return null;

  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <div
          key={f.flag_id}
          className={`rounded-xl border px-4 py-3 text-sm ${
            SEVERITY_TONE[f.severity] || "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              🚨 {f.severity} fraud flag — {f.flag_type.replaceAll("_", " ")}
            </span>
            <span className="text-xs opacity-80">{f.confidence}% confidence</span>
          </div>
          {f.evidence && Object.keys(f.evidence).length > 0 && (
            <p className="mt-1 text-xs opacity-90">
              {Object.entries(f.evidence)
                .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
                .join(" · ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
