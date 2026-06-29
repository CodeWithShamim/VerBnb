"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Sun/moon theme toggle. Reads the current theme from the <html class="dark">
 * that the no-flash script in layout.tsx already applied, so first paint is
 * correct and this only handles user clicks afterwards.
 *
 * Persists the explicit choice to localStorage. (localStorage is the right tool
 * here — a theme preference should survive across sessions; the project's
 * "no localStorage" rule was about transient dispute-form state, not this.)
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Sync initial state from the DOM after mount (avoids hydration mismatch).
  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage may be unavailable — theme still applies for this session */
    }
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="grid h-9 w-9 place-items-center rounded-xl border border-surface-border bg-white/60 text-slate-600 transition-colors hover:border-brand/40 hover:text-brand dark:bg-white/5 dark:text-slate-300"
    >
      {/* Render nothing until mounted to keep SSR/CSR markup identical. */}
      {theme === null ? (
        <span className="h-5 w-5" />
      ) : isDark ? (
        // Sun icon
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={1.8} />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // Moon icon
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
