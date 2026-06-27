"use client";

import { useEffect, useState } from "react";

interface SimilarCase {
  dispute_id: string;
  verdict: string;
  refund_percentage: number;
  required_appeals: number;
  match_score: number;
  claim_snippet: string;
}

/**
 * Shows past disputes in a category whose claim text keyword-overlaps the given
 * snippet (analytics_tracker.get_similar_disputes). Validators use this to
 * calibrate a new judgment against historical outcomes.
 */
export default function SimilarCases({
  category,
  claimSnippet,
}: {
  category: string;
  claimSnippet: string;
}) {
  const [cases, setCases] = useState<SimilarCase[]>([]);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!category || !claimSnippet) return;
    fetch(
      `/api/trackers?resource=similar&category=${encodeURIComponent(
        category
      )}&snippet=${encodeURIComponent(claimSnippet)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setCases(Array.isArray(d?.results) ? d.results : []);
        setCount(typeof d?.match_count === "number" ? d.match_count : 0);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [category, claimSnippet]);

  if (!loaded || count === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700">
        Similar disputes filed before:{" "}
        <span className="text-brand">{count}</span>
      </h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Verdict</th>
              <th className="px-3 py-2">Refund %</th>
              <th className="px-3 py-2">Appeals</th>
              <th className="px-3 py-2">Claim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {cases.map((c) => (
              <tr key={c.dispute_id}>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.verdict === "FAVORABLE"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-500"
                    }`}
                  >
                    {c.verdict}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-slate-700">
                  {c.refund_percentage}%
                </td>
                <td className="px-3 py-2 text-slate-500">{c.required_appeals}</td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-slate-500">
                  {c.claim_snippet}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
