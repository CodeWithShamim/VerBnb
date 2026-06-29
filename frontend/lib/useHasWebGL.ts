"use client";

import { useEffect, useState } from "react";

/**
 * Client-side WebGL capability check. Returns:
 *   - `null`  while detecting (first paint, SSR-safe)
 *   - `true`  when a WebGL context can be created
 *   - `false` when the device/browser has no WebGL
 *
 * Use to gate 3D Canvas rendering and fall back to a static visual otherwise.
 */
export function useHasWebGL(): boolean | null {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      setHasWebGL(!!gl);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  return hasWebGL;
}
