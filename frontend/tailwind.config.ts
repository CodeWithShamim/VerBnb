import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Per-category accent classes referenced dynamically from lib/contracts.ts
    "from-violet-500", "to-purple-500", "bg-violet-50", "text-violet-600",
    "from-cyan-500", "to-sky-500", "bg-cyan-50", "text-cyan-600",
    "from-emerald-500", "to-teal-500", "bg-emerald-50", "text-emerald-600",
    "from-amber-500", "to-orange-500", "bg-amber-50", "text-amber-600",
  ],
  theme: {
    extend: {
      colors: {
        // Hero design-system palette.
        hero: {
          purple: "#7b39fc",
          "purple-light": "#8b4dff",
          dark: "#2b2344",
          "dark-light": "#3a3059",
          offwhite: "#f6f7f9",
        },
        // Primary brand — retargeted to the hero purple design system.
        brand: {
          DEFAULT: "#7b39fc",
          dark: "#6b28e0",
          light: "#a06bff",
          50: "#f3ecff",
          100: "#e6d8ff",
          600: "#6b28e0",
        },
        surface: {
          DEFAULT: "var(--card-bg)",
          subtle: "var(--surface-subtle)",
          muted: "var(--surface-muted)",
          border: "var(--surface-border)",
        },
        // Per-category accent colors used across cards, forms and badges.
        cat: {
          rental: "#7b39fc", // purple (brand)
          product: "#06b6d4", // cyan
          sourcing: "#10b981", // emerald
          delivery: "#f59e0b", // amber
        },
        // Dopamine accents — vivid pops used for gradients, glows and chips.
        pop: {
          pink: "#ec4899",
          magenta: "#d946ef",
          orange: "#fb923c",
          lime: "#a3e635",
          cyan: "#22d3ee",
          violet: "#8b5cf6",
        },
      },
      fontFamily: {
        // Default sans is Manrope (UI/nav). Inter is kept for body/subtext.
        sans: ["Manrope", "system-ui", "sans-serif"],
        // Hero design-system fonts (loaded via @import in globals.css).
        manrope: ["Manrope", "system-ui", "sans-serif"],
        cabin: ["Cabin", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        "serif-hero": ["'Instrument Serif'", "Georgia", "serif"],
        inter: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)",
        lift: "0 12px 32px rgba(16,24,40,0.10), 0 4px 8px rgba(16,24,40,0.04)",
        glow: "0 0 0 1px rgba(123,57,252,0.20), 0 12px 40px rgba(123,57,252,0.22)",
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
        aurora: {
          "0%, 100%": {
            transform: "translate(0,0) rotate(0deg) scale(1)",
            opacity: "0.8",
          },
          "33%": {
            transform: "translate(6%,-4%) rotate(8deg) scale(1.12)",
            opacity: "1",
          },
          "66%": {
            transform: "translate(-5%,5%) rotate(-6deg) scale(0.94)",
            opacity: "0.7",
          },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(46px) rotate(0deg)" },
          "100%": {
            transform: "rotate(360deg) translateX(46px) rotate(-360deg)",
          },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shine: {
          "0%": { transform: "translateX(-150%) skewX(-18deg)" },
          "100%": { transform: "translateX(250%) skewX(-18deg)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        float: "float 7s ease-in-out infinite",
        "mesh-drift": "mesh-drift 22s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.66,0,0,1) infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        aurora: "aurora 16s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        orbit: "orbit 2.4s linear infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        shine: "shine 2.8s ease-in-out infinite",
        "bounce-soft": "bounce-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
