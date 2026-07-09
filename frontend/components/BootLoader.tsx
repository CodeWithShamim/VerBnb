"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * First-load boot screen. Server-rendered visible so it covers the very first
 * paint, runs a short eased progress count while the app hydrates, then sweeps
 * up off the screen in one continuous motion (matching the route curtain).
 * Reduced-motion users skip straight to the page.
 */

const BOOT_MS = 1500;
const EASE = [0.76, 0, 0.24, 1] as const;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function BootLoader() {
  const [done, setDone] = useState(false);
  const [pct, setPct] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setDone(true);
      return;
    }
    let raf = 0;
    let hold = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / BOOT_MS);
      setPct(Math.round(easeOut(t) * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        // Hold 100% for a beat so the completion registers before the sweep.
        hold = window.setTimeout(() => setDone(true), 200);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hold);
    };
  }, [reduce]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="hero-canvas fixed inset-0 z-[300] grid place-items-center"
          exit={{ y: "-100%", transition: { duration: 0.7, ease: EASE } }}
          style={{ willChange: "transform" }}
          aria-hidden
        >
          {/* gradient hairline on the sweep edge */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-hero-purple via-pop-pink to-pop-cyan" />

          <div className="flex w-64 flex-col items-center">
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif-hero text-5xl italic tracking-wide text-slate-900 dark:text-white"
            >
              VerBnb
            </motion.span>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-2 text-xs font-medium uppercase tracking-[0.25em] text-slate-400 dark:text-white/40"
            >
              AI consensus · on-chain
            </motion.p>

            {/* progress track */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-8 w-full"
            >
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-hero-purple via-pop-pink to-pop-cyan transition-[width] duration-100 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-slate-400 dark:text-white/40">
                  Connecting to GenLayer…
                </span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-600 dark:text-white/70">
                  {pct}%
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
