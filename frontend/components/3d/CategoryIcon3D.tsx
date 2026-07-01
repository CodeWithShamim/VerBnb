"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { Category } from "@/lib/contracts";

const SHAPES: Record<Category, { geometry: ReactNode; color: string }> = {
  RENTAL: { geometry: <boxGeometry args={[1, 1, 1]} />, color: "#7b39fc" },
  PRODUCT: { geometry: <dodecahedronGeometry args={[0.7]} />, color: "#06b6d4" },
  SOURCING: { geometry: <icosahedronGeometry args={[0.7, 1]} />, color: "#10b981" },
  DELIVERY: { geometry: <octahedronGeometry args={[0.8]} />, color: "#f59e0b" },
};

function Spinner({ category }: { category: Category }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { geometry, color } = SHAPES[category];

  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.01;
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        {geometry}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>
    </Float>
  );
}

/**
 * Small floating 3D badge for a dispute category. Sized to slot above a
 * category card. Fixed pixel size; one cheap mesh.
 */
export function CategoryIcon3D({
  category,
  size = 80,
}: {
  category: Category;
  size?: number;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: size, height: size }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[2, 2, 2]} intensity={1} />
      <Spinner category={category} />
    </Canvas>
  );
}

export default CategoryIcon3D;
