"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";

function FloatingModels() {
  return (
    <>
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh position={[0, 0, -2]}>
          <sphereGeometry args={[1.2, 64, 64]} />
          <MeshDistortMaterial
            color="#7C3AED"
            attach="material"
            distort={0.4}
            speed={2}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      </Float>

      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[3, 1.5, -1]}>
          <icosahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial
            color="#00D4FF"
            roughness={0.3}
            metalness={0.7}
            emissive="#00D4FF"
            emissiveIntensity={0.2}
          />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={0.8} floatIntensity={0.8}>
        <mesh position={[-3, -1, -1.5]}>
          <torusGeometry args={[0.5, 0.2, 16, 32]} />
          <meshStandardMaterial
            color="#C084FC"
            roughness={0.4}
            metalness={0.6}
            emissive="#7C3AED"
            emissiveIntensity={0.15}
          />
        </mesh>
      </Float>

      <Float speed={2.5} rotationIntensity={1.2} floatIntensity={0.6}>
        <mesh position={[-2, -2, 0]}>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial
            color="#0F1E3A"
            roughness={0.1}
            metalness={0.9}
            wireframe
          />
        </mesh>
      </Float>

      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={1.2}>
        <mesh position={[-2.5, 2, -0.5]}>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial
            color="#67E8F9"
            roughness={0.2}
            metalness={0.8}
            emissive="#00D4FF"
            emissiveIntensity={0.3}
          />
        </mesh>
      </Float>
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#7C3AED" />
      <pointLight position={[-10, -10, 5]} intensity={0.8} color="#00D4FF" />
      <directionalLight position={[0, 5, 5]} intensity={0.5} />
    </>
  );
}

export function HeroScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Lights />
          <FloatingModels />
        </Suspense>
      </Canvas>
    </div>
  );
}
