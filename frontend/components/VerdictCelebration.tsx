"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { SuccessBurst3D } from "@/components/3d";

/**
 * Fires a one-shot celebration (canvas-confetti + a 3D particle burst) when a
 * favorable verdict finalizes. Self-contained and additive: drop it inside a
 * relatively-positioned card. It renders only an absolutely-positioned,
 * pointer-transparent overlay, so it never affects layout or blocks clicks.
 *
 * Respects prefers-reduced-motion (skips confetti AND the burst).
 */
export default function VerdictCelebration({ favorable }: { favorable: boolean }) {
  const reduce = useReducedMotion();
  const firedRef = useRef(false);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!favorable || firedRef.current || reduce) return;
    firedRef.current = true;
    setBurst(true);

    // Confetti is loaded lazily so it never ships in the initial bundle.
    let cancelled = false;
    import("canvas-confetti")
      .then(({ default: confetti }) => {
        if (cancelled) return;
        const fire = (particleRatio: number, opts: Record<string, unknown>) =>
          confetti({
            origin: { y: 0.6 },
            particleCount: Math.floor(180 * particleRatio),
            colors: ["#6366f1", "#8b5cf6", "#22c55e", "#06b6d4"],
            ...opts,
          });
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      })
      .catch(() => {
        /* confetti is non-critical — ignore load failures */
      });

    // The 3D burst lasts ~2s; unmount it afterwards to free the canvas.
    const t = setTimeout(() => !cancelled && setBurst(false), 2200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [favorable, reduce]);

  if (!burst) return null;
  return <SuccessBurst3D active={burst} />;
}
