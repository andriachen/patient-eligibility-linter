"use client";

import { Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { Suspense, useState } from "react";

import { LandingGlassNav } from "@/components/landing/LandingGlassNav";
import { button, glassPanel } from "@/components/styles";

type TabId = "about" | "tools" | "start";

const TABS: { id: TabId; label: string }[] = [
  { id: "about", label: "About" },
  { id: "tools", label: "Tools" },
  { id: "start", label: "Get started" },
];

function LandingModel() {
  const { scene } = useGLTF("/models/landing.glb");

  return (
    <Center>
      <primitive object={scene} scale={1.75} />
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

function BackgroundCopy() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <p className="absolute left-[8%] top-[22%] max-w-xs text-4xl font-bold leading-tight text-blue-800/60 sm:text-5xl">
        Fair eligibility for every community
      </p>
      <p className="absolute bottom-[38%] right-[6%] max-w-sm text-right text-3xl font-bold text-pink-700/55 sm:text-4xl">
        Massachusetts cancer trials, mapped with care
      </p>
    </div>
  );
}

function TabPanel({ tab }: { tab: TabId }) {
  if (tab === "about") {
    return (
      <>
        <h2 className="text-lg font-semibold text-slate-800">Why StageShare</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700/95">
          Many trials exclude people with diabetes, BMI limits, language needs, and
          other criteria that land unevenly across Massachusetts counties. We connect{" "}
          <span className="font-medium text-slate-900">ClinicalTrials.gov</span>{" "}
          exclusions with{" "}
          <span className="font-medium text-slate-900">CDC PLACES</span> and county
          context so patients and protocol teams can see the gap early.
        </p>
      </>
    );
  }

  if (tab === "tools") {
    return (
      <>
        <h2 className="text-lg font-semibold text-slate-800">Three views</h2>
        <ul className="mt-3 space-y-3 text-sm text-slate-700/95">
          <li>
            <Link href="/landscape" className="font-semibold text-brand hover:underline">
              Landscape
            </Link>
            — how often trials exclude each category; filter by phase and sponsor.
          </li>
          <li>
            <Link href="/map" className="font-semibold text-brand hover:underline">
              Map
            </Link>
            — county-level exclusions plus community health and EJ metrics.
          </li>
          <li>
            <Link href="/linter" className="font-semibold text-brand hover:underline">
              Linter
            </Link>
            — paste draft criteria; review flags and suggestions (mock until pipeline
            is wired).
          </li>
        </ul>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-800">Jump in</h2>
      <p className="mt-2 text-sm text-slate-700/95">
        Drag the scene above to rotate · scroll or pinch to zoom. Public data only;
        suggestions are for protocol teams to review.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/landscape" className={button.primary}>
          Open Landscape
        </Link>
        <a
          rel="ar"
          href="/models/landing.usdz"
          className={`${button.secondary} border-pink-200/60 text-[var(--brand-secondary)]`}
        >
          View in AR (iPhone / iPad)
        </a>
      </div>
    </>
  );
}

export function LandingExperience() {
  const [tab, setTab] = useState<TabId>("about");

  return (
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-[#dbeafe] via-[#eef2ff] to-[#fce7f3]">
      <BackgroundCopy />

      {/* 3D scene in front of background text */}
      <div className="absolute inset-0 bottom-[11.5rem] z-10 sm:bottom-[10.5rem]">
        <Canvas
          className="h-full w-full"
          camera={{ position: [0, 0.12, 5.6], fov: 36 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={1.05} />
          <directionalLight position={[6, 8, 5]} intensity={1.35} />
          <directionalLight position={[-5, 3, -4]} intensity={0.55} color="#f9a8d4" />
          <Suspense fallback={<SceneFallback />}>
            <LandingModel />
          </Suspense>
          <OrbitControls
            enablePan={false}
            autoRotate={false}
            minDistance={3.2}
            maxDistance={11}
          />
        </Canvas>
      </div>

      <LandingGlassNav />

      {/* Tabbed liquid glass — sits below model, does not cover it */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-4 sm:px-6">
        <div className={`mx-auto max-w-3xl p-4 sm:p-5 ${glassPanel}`}>
          <div
            className="mb-4 flex gap-1 rounded-xl border border-white/60 bg-white/15 p-1"
            role="tablist"
            aria-label="About StageShare"
          >
            {TABS.map(({ id, label }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active
                      ? "border-white/80 bg-white/45 text-slate-900"
                      : "border-transparent text-slate-800 hover:bg-white/25"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div role="tabpanel">
            <TabPanel tab={tab} />
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-600/80">
          StageShare · Hackachusetts
        </p>
      </div>
    </div>
  );
}
