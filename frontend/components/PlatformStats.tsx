"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getReadClient } from "@/lib/genLayerClient";
import { REGISTRY_ADDRESS } from "@/lib/contracts";
import CountUp from "./CountUp";

interface Stats {
  total_disputes: number;
  total_resolved: number;
  resolution_rate: number;
}

export default function PlatformStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!REGISTRY_ADDRESS) {
        setLoaded(true);
        return;
      }
      try {
        const client = getReadClient();
        const raw = (await client.readContract({
          address: REGISTRY_ADDRESS,
          functionName: "get_platform_stats",
          args: [],
        })) as string;
        const parsed = JSON.parse(raw);
        if (!cancelled) setStats(parsed);
      } catch {
        /* keep null */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    {
      label: "Disputes filed",
      value: stats?.total_disputes ?? 0,
      suffix: "",
      tint: "from-indigo-500 to-violet-500",
    },
    {
      label: "Resolved on-chain",
      value: stats?.total_resolved ?? 0,
      suffix: "",
      tint: "from-cyan-500 to-sky-500",
    },
    {
      label: "Resolution rate",
      value: stats?.resolution_rate ?? 0,
      suffix: "%",
      tint: "from-emerald-500 to-teal-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className="card relative overflow-hidden p-6 text-center"
        >
          <span
            className={`pointer-events-none absolute inset-x-0 -top-px mx-auto h-1 w-2/3 rounded-full bg-gradient-to-r ${it.tint}`}
          />
          {!loaded ? (
            <div className="mx-auto h-9 w-20 rounded-md bg-surface-muted shimmer" />
          ) : (
            <div className="text-4xl font-extrabold tracking-tight text-slate-900">
              <CountUp value={it.value} suffix={it.suffix} />
            </div>
          )}
          <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {it.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
