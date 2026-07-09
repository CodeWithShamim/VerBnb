"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Professional route transition. On navigation a single deep-violet curtain
 * slides up from the bottom to cover the old page, then continues upward off
 * the new one — one continuous motion, no scale distortion. Gradient hairlines
 * mark the curtain's edges and a small wordmark rides in its center. Content
 * itself rises in with a blur-to-sharp settle. Keyed by pathname so
 * AnimatePresence runs the full exit/enter cycle per navigation. Honors
 * prefers-reduced-motion by rendering children with no animation.
 */

const EASE = [0.76, 0, 0.24, 1] as const;

function Curtain() {
  return (
    <motion.div
      className="hero-canvas pointer-events-none fixed inset-0 z-[95]"
      // Enter: curtain starts covering the screen, then slides up and away.
      initial={{ y: "0%" }}
      animate={{ y: "-100%", transition: { duration: 0.6, delay: 0.12, ease: EASE } }}
      // Exit: curtain rises from the bottom to cover the old page.
      exit={{ y: "0%", transition: { duration: 0.45, ease: EASE } }}
      style={{ willChange: "transform" }}
    >
      {/* gradient hairlines on both sweep edges */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-hero-purple via-pop-pink to-pop-cyan" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-pop-cyan via-hero-purple to-pop-pink" />

      <div className="grid h-full w-full place-items-center">
        <div className="flex flex-col items-center gap-3">
          <span className="font-serif-hero text-3xl italic tracking-wide text-slate-900 dark:text-white">
            VerBnb
          </span>
          <span className="h-[2px] w-24 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
            <motion.span
              className="block h-full w-full bg-gradient-to-r from-hero-purple via-pop-pink to-pop-cyan"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname}>
        <Curtain />
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: { duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] },
          }}
          exit={{
            opacity: 0,
            y: -16,
            filter: "blur(5px)",
            transition: { duration: 0.3, ease: EASE },
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
