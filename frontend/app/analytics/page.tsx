"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "@/lib/charts";
import { CATEGORIES, type Category } from "@/lib/contracts";
import { trackerFetch } from "@/lib/trackerClient";

interface CategoryStat {
  category: string;
  total_disputes: number;
  favorable_verdicts: number;
  unfavorable: number;
  avg_refund_pct: number;
  avg_resolution_time: number;
  consensus_rate: number;
}

interface Health {
  total_disputes_all_time: number;
  total_resolved: number;
  total_favorable: number;
  total_unfavorable: number;
  avg_resolution_time_all_categories: number;
  consensus_rate_overall: number;
  most_common_category: string;
}

const CATS: Category[] = ["RENTAL", "PRODUCT", "SOURCING", "DELIVERY"];
const PIE_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"];

function fmtDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [all, setAll] = useState<Record<string, CategoryStat> | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [tab, setTab] = useState<Category>("RENTAL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      trackerFetch("analytics_all"),
      trackerFetch("platform_health"),
    ])
      .then(([a, h]) => {
        if (!alive) return;
        if (a && !a.configured && typeof a === "object") setAll(a);
        else if (a && a.RENTAL) setAll(a);
        if (h && typeof h.total_disputes_all_time === "number") setHealth(h);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const categoryData = all
    ? CATS.map((c, i) => ({
        name: CATEGORIES[c].title,
        value: all[c]?.total_disputes ?? 0,
        fill: PIE_COLORS[i],
      })).filter((d) => d.value > 0)
    : [];

  const totalFav = health?.total_favorable ?? 0;
  const totalUnfav = health?.total_unfavorable ?? 0;
  const verdictData = [
    { name: "Favorable", value: totalFav, fill: "#10b981" },
    { name: "Unfavorable", value: totalUnfav, fill: "#f43f5e" },
  ];

  const active = all?.[tab];

  return (
    <div className="bg-grid min-h-screen">
      <div className="container-page max-w-6xl py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            VerBnb Platform Insights
          </h1>
          <p className="mt-1.5 text-slate-500">
            Aggregated dispute outcomes, consensus health, and category trends.
          </p>
        </header>

        {loading && (
          <div className="card p-10 text-center text-slate-400">
            Loading platform analytics…
          </div>
        )}

        {!loading && !all && !health && (
          <div className="card p-8 text-center text-slate-500">
            Analytics tracker is not configured yet. Set{" "}
            <code className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs">
              NEXT_PUBLIC_ANALYTICS_TRACKER
            </code>{" "}
            after deploying the Phase 2 contracts.
          </div>
        )}

        {!loading && (all || health) && (
          <>
            {/* Card 1: Overview KPIs */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Total disputes"
                value={String(health?.total_disputes_all_time ?? 0)}
              />
              <Kpi
                label="Avg resolution time"
                value={fmtDuration(health?.avg_resolution_time_all_categories ?? 0)}
              />
              <Kpi
                label="Consensus rate"
                value={`${health?.consensus_rate_overall ?? 0}%`}
              />
              <Kpi
                label="Most common"
                value={
                  health?.most_common_category
                    ? CATEGORIES[health.most_common_category as Category]?.title ||
                      health.most_common_category
                    : "—"
                }
              />
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Card 2: Disputes by Category (pie) */}
              <div className="card p-6">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  Disputes by category
                </h2>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        {categoryData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">
                    No disputes recorded yet.
                  </p>
                )}
              </div>

              {/* Card 3: Verdict Distribution (bar) */}
              <div className="card p-6">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  Verdict distribution
                </h2>
                {totalFav + totalUnfav > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={verdictData}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {verdictData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">
                    No verdicts recorded yet.
                  </p>
                )}
              </div>
            </div>

            {/* Card 4: Category deep dives (tabs) */}
            <section className="card mt-6 p-6">
              <div className="mb-5 flex flex-wrap gap-2">
                {CATS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTab(c)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      tab === c
                        ? "bg-brand text-white"
                        : "bg-surface-subtle text-slate-600 hover:bg-surface-muted"
                    }`}
                  >
                    {CATEGORIES[c].title}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Total" value={String(active?.total_disputes ?? 0)} />
                <Kpi
                  label="Avg refund"
                  value={`${active?.avg_refund_pct ?? 0}%`}
                />
                <Kpi
                  label="Avg time"
                  value={fmtDuration(active?.avg_resolution_time ?? 0)}
                />
                <Kpi
                  label="Consensus"
                  value={`${active?.consensus_rate ?? 0}%`}
                />
              </div>
              <p className="mt-4 text-xs text-slate-400">
                {CATEGORIES[tab].tagline}
              </p>
            </section>

            {/* Card 6: Validator participation summary */}
            <section className="card mt-6 p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                Platform health
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi
                  label="Resolved disputes"
                  value={String(health?.total_resolved ?? 0)}
                />
                <Kpi
                  label="Favorable verdicts"
                  value={String(totalFav)}
                />
                <Kpi
                  label="Overall consensus"
                  value={`${health?.consensus_rate_overall ?? 0}%`}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
