"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { itemVariants } from "./Reveal";
import type { CategoryMeta } from "@/lib/contracts";

const ICONS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
  box: "M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10",
  leaf: "M5 21c0-9 7-16 16-16 0 9-7 16-16 16Zm0 0c4-4 7-7 11-9",
  truck:
    "M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4Zm10 0a2 2 0 100-4 2 2 0 000 4Z",
};

export default function CategoryCard({ meta }: { meta: CategoryMeta }) {
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={`/${meta.slug}`}
        className="glass-card group relative block h-full overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
      >
        {/* accent wash that grows on hover */}
        <span
          className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${meta.gradient} opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-20`}
        />

        <span
          className={`relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-soft transition-transform duration-300 group-hover:scale-110`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-6 w-6"
          >
            <path
              d={ICONS[meta.icon]}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h3 className="relative mt-5 text-lg font-bold text-slate-900">
          {meta.title}
        </h3>
        <p className="relative mt-1.5 text-sm leading-relaxed text-slate-500">
          {meta.tagline}
        </p>

        <span
          className={`relative mt-5 inline-flex items-center gap-1 text-sm font-semibold ${meta.text}`}
        >
          Raise a dispute
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
