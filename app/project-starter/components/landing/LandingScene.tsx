"use client";

import { Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

function LandingModel() {
  const { scene } = useGLTF("/models/landing.glb");

  return (
    <Center>
      <primitive object={scene} scale={1} />
    </Center>
  );
}

useGLTF.preload("/models/landing.glb");

function SceneFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.8, 32, 32]} />
      <meshStandardMaterial color="#93c5fd" wireframe />
    </mesh>
  );
}

type Props = {
  fullscreen?: boolean;
};

export function LandingScene({ fullscreen = false }: Props) {
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-0 h-screen w-screen"
          : "relative h-[min(52vh,420px)] w-full overflow-hidden rounded-2xl border border-[var(--border)]"
      }
    >
      <Canvas
        className="h-full w-full"
        camera={{ position: [0, 0.35, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#e8eefc"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 8, 6]} intensity={1.15} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#fbcfe8" />
        <Suspense fallback={<SceneFallback />}>
          <LandingModel />
        </Suspense>
        <OrbitControls
          enablePan={false}
          autoRotate={false}
          minDistance={2.2}
          maxDistance={9}
          maxPolarAngle={Math.PI / 1.85}
          minPolarAngle={Math.PI / 5}
        />
      </Canvas>
      {fullscreen ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-950/25 via-transparent to-pink-900/20"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
