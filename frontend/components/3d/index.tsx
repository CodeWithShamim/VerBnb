"use client";

import dynamic from "next/dynamic";
import WebGLGuard from "./WebGLGuard";
import type { Category } from "@/lib/contracts";

// All 3D scenes are dynamically imported with ssr:false so Three.js never runs
// on the server, and gated behind WebGLGuard (reduced-motion + WebGL fallback).

const HeroScene = dynamic(
  () => import("./HeroScene").then((m) => m.HeroScene),
  { ssr: false, loading: () => null }
);

const ValidatorOrbCanvas = dynamic(
  () => import("./ValidatorOrb").then((m) => m.ValidatorOrbCanvas),
  { ssr: false, loading: () => null }
);

const CategoryIcon3D = dynamic(
  () => import("./CategoryIcon3D").then((m) => m.CategoryIcon3D),
  { ssr: false, loading: () => null }
);

const SuccessBurst = dynamic(
  () => import("./SuccessBurst").then((m) => m.SuccessBurst),
  { ssr: false, loading: () => null }
);

/** Floating geometry backdrop for the hero. No fallback (CSS mesh shows). */
export function HeroScene3D() {
  return (
    <WebGLGuard fallback={null}>
      <HeroScene />
    </WebGLGuard>
  );
}

/** 3D validator orb; falls back to a CSS pulse ring when 3D is unavailable. */
export function ValidatorOrb3D({ phase }: { phase: string }) {
  return (
    <WebGLGuard
      fallback={
        <div className="mx-auto grid h-44 w-44 place-items-center">
          <span className="relative flex h-20 w-20">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/30" />
            <span className="relative inline-flex h-20 w-20 rounded-full bg-gradient-to-br from-brand to-violet-500 opacity-80" />
          </span>
        </div>
      }
    >
      <ValidatorOrbCanvas phase={phase} />
    </WebGLGuard>
  );
}

/**
 * Small 3D category badge; falls back to the provided static node (the existing
 * SVG/emoji icon) so cards always show something.
 */
export function CategoryIconWith3D({
  category,
  size = 80,
  fallback = null,
}: {
  category: Category;
  size?: number;
  fallback?: React.ReactNode;
}) {
  return (
    <WebGLGuard fallback={fallback}>
      <CategoryIcon3D category={category} size={size} />
    </WebGLGuard>
  );
}

/** 3D success particle burst; no fallback (confetti covers the 2D case). */
export function SuccessBurst3D({ active }: { active: boolean }) {
  return (
    <WebGLGuard fallback={null}>
      <SuccessBurst active={active} />
    </WebGLGuard>
  );
}
