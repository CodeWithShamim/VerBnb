import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Per-category accent classes referenced dynamically from lib/contracts.ts
    "from-indigo-500", "to-violet-500", "bg-indigo-50", "text-indigo-600",
    "from-cyan-500", "to-sky-500", "bg-cyan-50", "text-cyan-600",
    "from-emerald-500", "to-teal-500", "bg-emerald-50", "text-emerald-600",
    "from-amber-500", "to-orange-500", "bg-amber-50", "text-amber-600",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand (indigo) + a light, clean surface system.
        brand: {
          DEFAULT: "#6366f1",
          dark: "#4f46e5",
          light: "#818cf8",
          50: "#eef2ff",
          100: "#e0e7ff",
          600: "#4f46e5",
        },
        surface: {
          DEFAULT: "var(--card-bg)",
          subtle: "var(--surface-subtle)",
          muted: "var(--surface-muted)",
          border: "var(--surface-border)",
        },
        // Per-category accent colors used across cards, forms and badges.
        cat: {
          rental: "#6366f1", // indigo
          product: "#06b6d4", // cyan
          sourcing: "#10b981", // emerald
          delivery: "#f59e0b", // amber
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)",
        lift: "0 12px 32px rgba(16,24,40,0.10), 0 4px 8px rgba(16,24,40,0.04)",
        glow: "0 0 0 1px rgba(99,102,241,0.18), 0 12px 40px rgba(99,102,241,0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "mesh-drift": {
          "0%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(4%,-3%) scale(1.08)" },
          "66%": { transform: "translate(-3%,4%) scale(0.96)" },
          "100%": { transform: "translate(0,0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.45)" },
          "70%": { boxShadow: "0 0 0 12px rgba(99,102,241,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        float: "float 7s ease-in-out infinite",
        "mesh-drift": "mesh-drift 22s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.66,0,0,1) infinite",
        "gradient-x": "gradient-x 6s ease infinite",
      },
    },
  },
  plugins: [],
};
export default config;
