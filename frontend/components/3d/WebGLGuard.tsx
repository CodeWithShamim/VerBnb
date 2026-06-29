"use client";

import { type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { useHasWebGL } from "@/lib/useHasWebGL";

/**
 * Gate for any 3D scene. Renders `children` (the Canvas) only when:
 *   - the user has NOT requested reduced motion, AND
 *   - the device supports WebGL.
 *
 * Otherwise renders `fallback` (a static, no-GPU visual). While WebGL support
 * is still being detected, renders the fallback so first paint is always safe.
 *
 * Every 3D component in this folder is wrapped in this guard, satisfying the
 * "respect prefers-reduced-motion" and "WebGL fallback" hard constraints in one
 * place.
 */
export default function WebGLGuard({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const hasWebGL = useHasWebGL();

  if (reduce || hasWebGL === false || hasWebGL === null) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
