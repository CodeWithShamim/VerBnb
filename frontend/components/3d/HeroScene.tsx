'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Preload, Sparkles } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect, Suspense, type ReactNode } from 'react';
import * as THREE from 'three';

/** Tracks the <html class="dark"> theme flag, live across toggles. */
function useIsDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

type ShapeDef = {
  pos: [number, number, number];
  geo: ReactNode;
  color: string;
  speed: number;
  distort: number;
};

function FloatingShape({
  position,
  geometry,
  color,
  speed,
  distort,
}: {
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
    // Per-frame mutation only - never setState in the frame loop.
    mesh.rotation.x += 0.003 * speed;
    mesh.rotation.y += 0.005 * speed;
    mesh.scale.setScalar(hovered ? 1.15 : 1 + Math.sin(state.clock.elapsedTime * speed) * 0.03);
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

/** Slowly-breathing distorted sphere sitting deep behind the hero's right half. */
function CoreSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.y += 0.0015;
    mesh.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05);
  });
  return (
    <mesh ref={meshRef} position={[2.8, 0.4, -7]}>
      <sphereGeometry args={[2.4, 32, 32]} />
      <MeshDistortMaterial
        color="#7b39fc"
        emissive="#ec4899"
        emissiveIntensity={0.25}
        distort={0.45}
        speed={1.2}
        transparent
        opacity={0.28}
        roughness={0.2}
        metalness={0.8}
        wireframe
      />
    </mesh>
  );
}

function Scene({ isDark }: { isDark: boolean }) {
  // Geometries are declared once and memoized - never recreated per frame.
  // Weighted to the hero's right half - the headline copy owns the left side.
  const shapes = useMemo<ShapeDef[]>(
    () => [
      {
        pos: [3.2, 1.6, -3],
        geo: <icosahedronGeometry args={[0.8, 1]} />,
        color: '#7b39fc',
        speed: 0.8,
        distort: 0.3,
      },
      {
        pos: [2.6, -1.4, -2],
        geo: <octahedronGeometry args={[0.9]} />,
        color: '#ec4899',
        speed: 0.6,
        distort: 0.2,
      },
      {
        pos: [1.2, 2.6, -4],
        geo: <torusGeometry args={[0.55, 0.22, 16, 32]} />,
        color: '#fb923c',
        speed: 1.0,
        distort: 0.35,
      },
      {
        pos: [-3.4, -2.2, -5],
        geo: <dodecahedronGeometry args={[0.6]} />,
        color: '#22d3ee',
        speed: 0.7,
        distort: 0.25,
      },
    ],
    [],
  );

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#a06bff" />
      <pointLight position={[-5, -5, 5]} intensity={0.7} color="#ec4899" />
      {/* Theme-matched fog so distant shapes melt into the hero canvas. */}
      <fog attach="fog" args={[isDark ? '#0d0920' : '#f2f0fc', 8, 22]} />
      <MouseTracker />
      <CoreSphere />
      {/* Glittering dust field - cheap points, big dopamine payoff. */}
      <Sparkles
        count={70}
        scale={[14, 8, 8]}
        size={2.2}
        speed={0.3}
        color={isDark ? '#c4b5fd' : '#7c3aed'}
        opacity={isDark ? 0.6 : 0.45}
      />
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
 * Pointer events disabled at the wrapper so it never blocks the hero CTAs -
 * hover-on-shape still works because R3F attaches its own listeners to Canvas.
 */
export function HeroScene() {
  const isDark = useIsDark();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  // Render only while the hero is on screen AND the tab is visible - otherwise
  // the WebGL frameloop keeps burning GPU behind the rest of the page.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let inView = true;
    const sync = () => setActive(inView && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        frameloop={active ? 'always' : 'never'}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Scene isDark={isDark} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default HeroScene;
