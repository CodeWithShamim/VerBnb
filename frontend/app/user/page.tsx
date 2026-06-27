"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import ReputationBadge from "@/components/ReputationBadge";
import FraudAlert from "@/components/FraudAlert";

interface UserStats {
  address: string;
  disputes_filed: number;
  disputes_won?: number;
  disputes_lost?: number;
  win_rate: number;
  validator_accuracy: number;
  appeal_success: number;
  overall_score: number;
}

interface ActivityEvent {
  event_type: string;
  timestamp: number;
  dispute_id: string;
  details: string;
}

function fmtDate(ts: number): string {
  if (!ts) return "—";
  try {
    return format(new Date(ts * 1000), "MMM d, yyyy HH:mm");
  } catch {
    return "—";
  }
}

const EVENT_LABEL: Record<string, string> = {
  DISPUTE_FILED: "Dispute filed",
  DISPUTE_WON: "Dispute won",
  DISPUTE_LOST: "Dispute lost",
  VALIDATOR_ROUND: "Validator round",
  APPEAL_FILED: "Appeal filed",
  APPEAL_WON: "Appeal won",
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function ProfileInner() {
  const search = useSearchParams();
  const [address, setAddress] = useState(search.get("address") || "");
  const [input, setInput] = useState(search.get("address") || "");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/trackers?resource=user_stats&address=${encodeURIComponent(address)}`).then(
        (r) => r.json()
      ),
      fetch(
        `/api/trackers?resource=activity&address=${encodeURIComponent(address)}&limit=50`
      ).then((r) => r.json()),
    ])
      .then(([s, a]) => {
        if (s && typeof s.disputes_filed === "number") setStats(s);
        setActivity(Array.isArray(a?.events) ? a.events : []);
      })
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-4xl py-12">
        {/* Address lookup */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAddress(input.trim());
          }}
          className="mb-8 flex flex-wrap gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x… user address"
            className="flex-1 rounded-xl border border-surface-border bg-white px-4 py-2.5 font-mono text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="btn-primary px-5 py-2.5 text-sm"
          >
            View profile
          </button>
        </form>

        {!address && (
          <div className="card p-8 text-center text-slate-500">
            Enter a wallet address to view its reputation and activity.
          </div>
        )}

        {address && (
          <>
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Profile
                </p>
                <p className="mt-1 break-all font-mono text-lg font-bold text-slate-900">
                  {address}
                </p>
              </div>
              <ReputationBadge address={address} size="large" />
            </header>

            <FraudAlert address={address} />

            {loading && (
              <div className="card mt-4 p-8 text-center text-slate-400">
                Loading reputation…
              </div>
            )}

            {!loading && (
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {/* Card 1: Reputation summary */}
                <div className="card p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-700">
                    Reputation summary
                  </h2>
                  <StatRow
                    label="Overall score"
                    value={`${stats?.overall_score ?? 0}/100`}
                  />
                  <StatRow
                    label="Disputes filed"
                    value={String(stats?.disputes_filed ?? 0)}
                  />
                  <StatRow
                    label="Win rate"
                    value={`${stats?.win_rate ?? 0}% (${stats?.disputes_won ?? 0}/${
                      (stats?.disputes_won ?? 0) + (stats?.disputes_lost ?? 0)
                    })`}
                  />
                  <StatRow
                    label="Validator accuracy"
                    value={`${stats?.validator_accuracy ?? 0}%`}
                  />
                  <StatRow
                    label="Appeal success"
                    value={`${stats?.appeal_success ?? 0}%`}
                  />
                </div>

                {/* Card 2: Activity timeline */}
                <div className="card p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-700">
                    Activity timeline
                  </h2>
                  {activity.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">
                      No activity recorded.
                    </p>
                  ) : (
                    <ol className="relative space-y-4 border-l border-surface-border pl-4">
                      {activity.slice(0, 12).map((e, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[1.36rem] top-1 h-2.5 w-2.5 rounded-full bg-brand" />
                          <p className="text-sm font-medium text-slate-700">
                            {EVENT_LABEL[e.event_type] || e.event_type}
                            {e.dispute_id ? ` · ${e.dispute_id}` : ""}
                          </p>
                          <p className="text-xs text-slate-400">
                            {fmtDate(e.timestamp)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}

            {/* Card 3: Dispute history table */}
            {!loading && activity.length > 0 && (
              <div className="card mt-6 p-6">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">
                  Dispute history
                </h2>
                <div className="overflow-hidden rounded-lg border border-surface-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Event</th>
                        <th className="px-3 py-2">Dispute</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {activity
                        .filter((e) => e.dispute_id)
                        .map((e, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-500">
                              {fmtDate(e.timestamp)}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {EVENT_LABEL[e.event_type] || e.event_type}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-500">
                              {e.dispute_id}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense fallback={<div className="bg-grid min-h-screen" />}>
      <ProfileInner />
    </Suspense>
  );
}
