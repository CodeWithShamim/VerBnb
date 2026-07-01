"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";
import { PHASE_COLORS } from "@/lib/constants";

function ValidatorOrb({ phase }: { phase: string }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const orb = orbRef.current;
    if (orb) {
      orb.rotation.y += 0.01;
      orb.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
    ringsRef.current.forEach((ring, i) => {
      if (ring) ring.rotation.z += 0.008 * (i + 1);
    });
  });

  const orbColor = PHASE_COLORS[phase?.toUpperCase()] || "#7b39fc";

  return (
    <group>
      {/* Central orb */}
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.8, 64, 64]} />
        <MeshDistortMaterial
          color={orbColor}
          emissive={orbColor}
          emissiveIntensity={0.4}
          distort={0.3}
          speed={3}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Validator rings orbiting the orb */}
      {[1.4, 1.8, 2.2].map((radius, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringsRef.current[i] = el;
          }}
          rotation={[Math.PI / (i + 2), 0, 0]}
        >
          <torusGeometry args={[radius, 0.02, 8, 64]} />
          <meshBasicMaterial color={orbColor} transparent opacity={0.4 - i * 0.1} />
        </mesh>
      ))}

      <pointLight color={orbColor} intensity={2} distance={5} />
    </group>
  );
}

/**
 * Animated 3D validation orb shown while a dispute is in flight. The orb color
 * tracks the consensus phase (amber → blue → violet → green). Small, fixed-size
 * canvas; cheap to render.
 */
export function ValidatorOrbCanvas({ phase }: { phase: string }) {
  return (
    <div className="mx-auto h-44 w-44">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <ValidatorOrb phase={phase} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default ValidatorOrbCanvas;
