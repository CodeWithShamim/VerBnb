"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Preload } from "@react-three/drei";
import { useRef, useMemo, useState, Suspense, type ReactNode } from "react";
import * as THREE from "three";

type ShapeDef = {
  pos: [number, number, number];
  geo: ReactNode;
  color: string;
  speed: number;
  distort: number;
};

function FloatingShape({ position, geometry, color, speed, distort }: {
  position: [number, number, number];
  geometry: ReactNode;
  color: string;
  speed: number;
  distort: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Per-frame mutation only — never setState in the frame loop.
    mesh.rotation.x += 0.003 * speed;
    mesh.rotation.y += 0.005 * speed;
    mesh.scale.setScalar(
      hovered ? 1.15 : 1 + Math.sin(state.clock.elapsedTime * speed) * 0.03
    );
  });

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh
        ref={meshRef}
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {geometry}
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.45 : 0.18}
          distort={hovered ? 0.5 : distort}
          speed={2}
          transparent
          opacity={0.55}
          roughness={0.15}
          metalness={0.7}
        />
      </mesh>
    </Float>
  );
}

function MouseTracker() {
  const { camera } = useThree();
  useFrame(({ mouse }) => {
    camera.position.x += (mouse.x * 1.5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 1.0 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene() {
  // Geometries are declared once and memoized — never recreated per frame.
  const shapes = useMemo<ShapeDef[]>(
    () => [
      { pos: [-3, 1.5, -2], geo: <icosahedronGeometry args={[0.8, 1]} />, color: "#6366f1", speed: 0.8, distort: 0.3 },
      { pos: [3, -1.0, -3], geo: <octahedronGeometry args={[1.0]} />, color: "#8b5cf6", speed: 0.6, distort: 0.2 },
      { pos: [0, 2.5, -4], geo: <torusGeometry args={[0.6, 0.25, 16, 32]} />, color: "#a78bfa", speed: 1.0, distort: 0.4 },
      { pos: [-2, -2.0, -2], geo: <dodecahedronGeometry args={[0.7]} />, color: "#22d3ee", speed: 0.7, distort: 0.25 },
      { pos: [2, 1.0, -1], geo: <icosahedronGeometry args={[0.5, 0]} />, color: "#818cf8", speed: 1.2, distort: 0.35 },
    ],
    []
  );

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#818cf8" />
      <pointLight position={[-5, -5, 5]} intensity={0.6} color="#a78bfa" />
      {/* Light-theme fog so distant shapes fade into the page background. */}
      <fog attach="fog" args={["#f8fafc", 8, 22]} />
      <MouseTracker />
      {shapes.map((s, i) => (
        <FloatingShape
          key={i}
          position={s.pos}
          geometry={s.geo}
          color={s.color}
          speed={s.speed}
          distort={s.distort}
        />
      ))}
      <Preload all />
    </>
  );
}

/**
 * Floating geometry backdrop for the landing hero. Light-theme friendly:
 * transparent alpha so the CSS mesh + grid show through, soft accent colors.
 * Pointer events disabled at the wrapper so it never blocks the hero CTAs —
 * hover-on-shape still works because R3F attaches its own listeners to Canvas.
 */
export function HeroScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default HeroScene;
