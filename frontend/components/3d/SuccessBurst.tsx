'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';

function ParticleBurst({ active }: { active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 80;

  // Initial tight cluster at origin - memoized, never recreated per frame.
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.1;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    return arr;
  }, []);

  const velocities = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 0.08,
        y: (Math.random() - 0.5) * 0.08,
        z: (Math.random() - 0.5) * 0.08,
      })),
    [],
  );

  const startTime = useRef<number | null>(null);

  useFrame((state) => {
    const pts = pointsRef.current;
    if (!active || !pts) return;
    if (startTime.current === null) startTime.current = state.clock.elapsedTime;

    const elapsed = state.clock.elapsedTime - startTime.current;
    if (elapsed > 2) return; // burst lasts 2 seconds

    const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      attr.array[i * 3] += velocities[i].x;
      attr.array[i * 3 + 1] += velocities[i].y;
      attr.array[i * 3 + 2] += velocities[i].z;
    }
    attr.needsUpdate = true;
    (pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - elapsed / 2);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#22c55e" transparent opacity={1} />
    </points>
  );
}

/**
 * Brief 3D particle burst overlaid on a favorable verdict. Renders an
 * absolutely-positioned, pointer-transparent canvas so it never blocks the
 * card beneath it. Pair with canvas-confetti for the full celebration.
 */
export function SuccessBurst({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <ParticleBurst active={active} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default SuccessBurst;
