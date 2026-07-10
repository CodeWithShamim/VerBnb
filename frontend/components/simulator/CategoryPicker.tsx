"use client";

import { CATEGORIES, type Category } from "@/lib/contracts";

/** Same icon paths CategoryCard uses (kept local - simulator owns its files). */
const ICONS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
  box: "M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10",
  leaf: "M5 21c0-9 7-16 16-16 0 9-7 16-16 16Zm0 0c4-4 7-7 11-9",
  truck:
    "M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4Zm10 0a2 2 0 100-4 2 2 0 000 4Z",
};

/**
 * Compact 2x2 category selector for the simulator draft form - the four
 * CATEGORIES rendered as selectable cards with their gradient identity.
 */
export default function CategoryPicker({
  value,
  onChange,
}: {
  value: Category;
  onChange: (c: Category) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Dispute category">
      {Object.values(CATEGORIES).map((meta) => {
        const selected = meta.key === value;
        return (
          <button
            key={meta.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(meta.key)}
            className={`group relative overflow-hidden rounded-xl border p-3.5 text-left transition-all duration-200 ${
              selected
                ? "border-transparent"
                : "border-surface-border bg-surface-subtle hover:border-brand/40 hover:bg-surface"
            }`}
            style={
              selected
                ? { boxShadow: `0 0 0 2px ${meta.accent}`, background: "var(--card-bg)" }
                : undefined
            }
          >
            {/* accent wash on the selected card */}
            {selected && (
              <span
                className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${meta.gradient} opacity-15 blur-xl`}
              />
            )}
            <span className="flex items-center gap-2.5">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white transition-transform duration-200 ${
                  selected ? "scale-105" : "opacity-80 group-hover:opacity-100"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="h-4 w-4"
                >
                  <path d={ICONS[meta.icon]} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    selected ? meta.text : "text-slate-700"
                  }`}
                >
                  {meta.title}
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  {meta.tagline}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
