"use client";

import { CATEGORIES, type Category } from "@/lib/contracts";

export type CategoryFilter = Category | "ALL";
export type StatusFilter = "ALL" | "PENDING" | "RESOLVED";

const CATS: Category[] = ["RENTAL", "PRODUCT", "SOURCING", "DELIVERY"];
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "RESOLVED", label: "Resolved" },
];

/** Category chips + status toggle, applied to whichever list is on screen. */
export default function FilterBar({
  category,
  onCategory,
  status,
  onStatus,
}: {
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCategory("ALL")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            category === "ALL"
              ? "bg-brand text-white"
              : "bg-surface-subtle text-slate-600 hover:bg-surface-muted"
          }`}
        >
          All
        </button>
        {CATS.map((c) => {
          const meta = CATEGORIES[c];
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onCategory(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? `bg-gradient-to-r ${meta.gradient} text-white shadow-soft`
                  : "bg-surface-subtle text-slate-600 hover:bg-surface-muted"
              }`}
            >
              {meta.title}
            </button>
          );
        })}
      </div>

      <div className="inline-flex rounded-full border border-surface-border bg-surface-subtle p-0.5">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onStatus(s.key)}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
              status === s.key
                ? "bg-white text-slate-900 shadow-soft dark:bg-white/10 dark:text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
