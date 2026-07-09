"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Cinematic route transition. On every client-side navigation three colored
 * curtain panels sweep up over the old page, then peel away upward off the new
 * one while the content itself rises in with a blur-to-sharp pop. Keyed by
 * pathname so AnimatePresence runs the full exit/enter cycle per navigation.
 * Purely visual and additive; honors prefers-reduced-motion by rendering
 * children with no animation.
 */

const EASE = [0.76, 0, 0.24, 1] as const;

/** Curtain layers, back to front. The front panel carries the brand mark. */
const PANELS = [
  { bg: "linear-gradient(135deg, #22d3ee, #7b39fc)", delay: 0.08 },
  { bg: "linear-gradient(135deg, #ec4899, #fb923c)", delay: 0.04 },
  { bg: "linear-gradient(135deg, #17112e, #2b2344)", delay: 0 },
];

function Curtain() {
  return (
    <>
      {PANELS.map((p, i) => (
        <motion.div
          key={i}
          className="fixed inset-0 pointer-events-none"
          style={{ background: p.bg, zIndex: 90 + i }}
          // Enter: panel starts covering the screen, then slides away upward.
          initial={{ scaleY: 1, originY: 0 }}
          animate={{
            scaleY: 0,
            originY: 0,
            transition: { duration: 0.5, delay: p.delay, ease: EASE },
          }}
          // Exit: panel grows up from the bottom to cover the old page.
          exit={{
            scaleY: 1,
            originY: 1,
            transition: { duration: 0.4, delay: p.delay, ease: EASE },
          }}
        >
          {i === PANELS.length - 1 && (
            <div className="grid h-full w-full place-items-center">
              <span className="font-serif-hero text-3xl italic tracking-wide text-white/90">
                VerBnb
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </>
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
          initial={{ opacity: 0, y: 28, scale: 0.985, filter: "blur(10px)" }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            transition: { duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] },
          }}
          exit={{
            opacity: 0,
            y: -20,
            scale: 0.99,
            filter: "blur(6px)",
            transition: { duration: 0.35, ease: EASE },
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
