"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, MeshDistortMaterial } from "@react-three/drei";
import { useIsClient } from "@/hooks/useIsClient";

function Flacon() {
  return (
    <Float speed={1.6} rotationIntensity={0.5} floatIntensity={0.9}>
      <group rotation={[0.1, 0.4, 0]}>
        {/* glass body (translucent so the essence glows through) */}
        <mesh>
          <cylinderGeometry args={[0.98, 0.98, 2.5, 64]} />
          <meshPhysicalMaterial
            color="#0a0e18"
            transparent
            opacity={0.28}
            metalness={0.4}
            roughness={0.08}
            emissive="#22d3ee"
            emissiveIntensity={0.12}
          />
        </mesh>
        {/* swirling essence */}
        <mesh>
          <sphereGeometry args={[0.8, 64, 64]} />
          <MeshDistortMaterial
            color="#22d3ee"
            emissive="#a855f7"
            emissiveIntensity={0.55}
            distort={0.4}
            speed={2.2}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>
        {/* neck + cap */}
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.34, 0.5, 0.5, 48]} />
          <meshStandardMaterial color="#0a0e18" metalness={0.8} roughness={0.25} emissive="#22d3ee" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0, 2.05, 0]}>
          <cylinderGeometry args={[0.44, 0.44, 0.6, 48]} />
          <meshStandardMaterial color="#a855f7" metalness={0.85} roughness={0.2} emissive="#a855f7" emissiveIntensity={0.45} />
        </mesh>
      </group>
    </Float>
  );
}

function OrbitingSpark({ radius, speed, offset }: { radius: number; speed: number; offset: number }) {
  return (
    <Float speed={speed} floatIntensity={1.4} rotationIntensity={0}>
      <mesh position={[Math.cos(offset) * radius, Math.sin(offset) * 0.6, Math.sin(offset) * radius]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} />
      </mesh>
    </Float>
  );
}

export function Hero3D() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="relative grid h-full w-full place-items-center">
        <div className="h-48 w-48 rounded-full border border-accent/30">
          <div className="ripple-ring" />
        </div>
      </div>
    );
  }

  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={40} color="#22d3ee" />
      <pointLight position={[-4, -2, -3]} intensity={30} color="#a855f7" />
      <spotLight position={[0, 6, 2]} angle={0.5} penumbra={1} intensity={25} color="#e6f1ff" />
      <Suspense fallback={null}>
        <Flacon />
        {[0, 1.2, 2.5, 3.8, 5].map((o, i) => (
          <OrbitingSpark key={i} radius={2.4 + (i % 2) * 0.4} speed={1.2 + i * 0.3} offset={o} />
        ))}
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.4} />
    </Canvas>
  );
}

export default Hero3D;
