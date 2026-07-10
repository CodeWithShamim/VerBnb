"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { trackerFetch } from "@/lib/trackerClient";
import { CATEGORIES, type Category } from "@/lib/contracts";
import CountUp from "@/components/CountUp";

interface PlatformStats {
  total_disputes: number;
  total_resolved: number;
  resolution_rate: number;
}

const CATS: Category[] = ["RENTAL", "PRODUCT", "SOURCING", "DELIVERY"];

/**
 * Explorer stats strip: totals from the registry's get_platform_stats plus a
 * per-category row from the analytics tracker (hidden when not configured).
 */
export default function ExplorerStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [byCategory, setByCategory] = useState<Record<string, number> | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [platform, all] = await Promise.all([
          trackerFetch("platform_stats"),
          trackerFetch("analytics_all").catch(() => null),
        ]);
        if (cancelled) return;
        if (typeof platform?.total_disputes === "number") setStats(platform);
        // Valid analytics payloads always carry the RENTAL key; anything else
        // ({configured:false}, {error}) means "no per-category data".
        if (all && all.RENTAL) {
          const counts: Record<string, number> = {};
          for (const c of CATS) counts[c] = all[c]?.total_disputes ?? 0;
          setByCategory(counts);
        }
      } catch {
        /* keep nulls */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = stats?.total_disputes ?? 0;
  const resolved = stats?.total_resolved ?? 0;
  const pending = Math.max(0, total - resolved);

  const items = [
    { label: "Total disputes", value: total, suffix: "", tint: "from-violet-500 to-purple-500" },
    { label: "Resolved on-chain", value: resolved, suffix: "", tint: "from-emerald-500 to-teal-500" },
    { label: "Pending", value: pending, suffix: "", tint: "from-amber-500 to-orange-500" },
    { label: "Resolution rate", value: stats?.resolution_rate ?? 0, suffix: "%", tint: "from-cyan-500 to-sky-500" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="card relative overflow-hidden p-5 text-center"
          >
            <span
              className={`pointer-events-none absolute inset-x-0 -top-px mx-auto h-1 w-2/3 rounded-full bg-gradient-to-r ${it.tint}`}
            />
            {!loaded ? (
              <div className="mx-auto h-8 w-16 rounded-md bg-surface-muted shimmer" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                <CountUp value={it.value} suffix={it.suffix} />
              </div>
            )}
            <div className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {it.label}
            </div>
          </motion.div>
        ))}
      </div>

      {byCategory && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-4 flex flex-wrap items-center justify-center gap-2"
        >
          {CATS.map((c) => (
            <span key={c} className="chip">
              <span
                className={`h-2 w-2 rounded-full bg-gradient-to-r ${CATEGORIES[c].gradient}`}
              />
              {CATEGORIES[c].title}
              <span className="font-semibold text-slate-900">
                {byCategory[c] ?? 0}
              </span>
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}
