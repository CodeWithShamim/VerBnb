"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "@/lib/charts";
import { format } from "date-fns";
import ReputationBadge from "@/components/ReputationBadge";
import { trackerFetch } from "@/lib/trackerClient";

interface Rep {
  address: string;
  validator_rounds: number;
  validator_agreements: number;
  overall_score: number;
  disputes_won?: number;
  disputes_lost?: number;
}

interface ActivityEvent {
  event_type: string;
  timestamp: number;
  details: string;
}

// Illustrative GEN reward per agreed validator round (no on-chain ledger yet).
const REWARD_PER_ROUND = 2;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ValidatorInner() {
  const search = useSearchParams();
  const [address, setAddress] = useState(search.get("address") || "");
  const [input, setInput] = useState(search.get("address") || "");
  const [rep, setRep] = useState<Rep | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      trackerFetch("reputation", { address }),
      trackerFetch("activity", { address, limit: 50 }),
    ])
      .then(([r, a]) => {
        if (!alive) return;
        if (r && typeof r.validator_rounds === "number") setRep(r);
        setActivity(Array.isArray(a?.events) ? a.events : []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [address]);

  const rounds = rep?.validator_rounds ?? 0;
  const agreements = rep?.validator_agreements ?? 0;
  const agreementRate = rounds > 0 ? Math.round((agreements / rounds) * 100) : 0;
  const earnings = agreements * REWARD_PER_ROUND;

  // Build a daily earnings series from validator-round activity events.
  const validatorEvents = activity.filter((e) => e.event_type === "VALIDATOR_ROUND");
  const dailyMap = new Map<string, number>();
  for (const e of validatorEvents) {
    let agreed = false;
    try {
      agreed = JSON.parse(e.details)?.agreed === true;
    } catch {
      agreed = false;
    }
    if (!agreed) continue;
    const day = e.timestamp ? format(new Date(e.timestamp * 1000), "MMM d") : "—";
    dailyMap.set(day, (dailyMap.get(day) || 0) + REWARD_PER_ROUND);
  }
  const earningsSeries = Array.from(dailyMap.entries())
    .map(([day, gen]) => ({ day, gen }))
    .slice(-30);

  const accuracySeries = [
    { name: "Agreed", value: agreements },
    { name: "Disagreed", value: Math.max(0, rounds - agreements) },
  ];

  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-6xl py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Validator Dashboard
          </h1>
          <p className="mt-1.5 text-slate-500">
            Participation, agreement accuracy and reward estimates per validator.
          </p>
        </header>

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
            placeholder="0x… validator address"
            className="flex-1 rounded-xl border border-surface-border bg-white px-4 py-2.5 font-mono text-sm focus:border-brand focus:outline-none"
          />
          <button type="submit" className="btn-primary px-5 py-2.5 text-sm">
            Load dashboard
          </button>
        </form>

        {!address && (
          <div className="card p-8 text-center text-slate-500">
            Enter a validator address to see its stats.
          </div>
        )}

        {address && loading && (
          <div className="card p-8 text-center text-slate-400">Loading…</div>
        )}

        {address && !loading && (
          <>
            {/* Card 1: Your stats */}
            <section className="card mb-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-3">
                  <Stat label="Rounds participated" value={String(rounds)} />
                  <Stat label="Agreement rate" value={`${agreementRate}%`} />
                  <Stat label="Est. earnings" value={`${earnings} GEN`} />
                </div>
                <ReputationBadge address={address} size="large" />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Card 3: Earnings chart */}
              <div className="card p-6">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  Daily GEN earned (estimated)
                </h2>
                {earningsSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={earningsSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="gen"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">
                    No reward-bearing rounds recorded yet.
                  </p>
                )}
              </div>

              {/* Card 4: Performance */}
              <div className="card p-6">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  Agreement vs majority
                </h2>
                {rounds > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={accuracySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">
                    No validator rounds recorded yet.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Earnings are estimated at {REWARD_PER_ROUND} GEN per agreed round
              (illustrative — no on-chain reward ledger).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ValidatorDashboardPage() {
  return (
    <Suspense fallback={<div className="bg-grid min-h-screen" />}>
      <ValidatorInner />
    </Suspense>
  );
}
