"use client";

import dynamic from "next/dynamic";

const LandingScene = dynamic(
  () =>
    import("@/components/landing/LandingScene").then((m) => m.LandingScene),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-0 flex items-center justify-center bg-[var(--hero-gradient-from)] text-sm text-[var(--muted)]">
        Loading 3D model…
      </div>
    ),
  },
);

export function LandingModelViewer() {
  return <LandingScene fullscreen />;
}
