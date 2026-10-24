"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const depth = (px: number) => ({ "--depth": px }) as CSSProperties;

/** Slow-drifting color fields with a small pointer parallax (max 8px). */
export function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!el || reduced.matches || !finePointer.matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty("--px", x.toFixed(3));
        el.style.setProperty("--py", y.toFixed(3));
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="enter-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-page"
    >
      <div className="ambient-layer" style={depth(4)}>
        <div className="ambient-blob ambient-blob--ice" />
      </div>
      <div className="ambient-layer" style={depth(6)}>
        <div className="ambient-blob ambient-blob--lavender" />
      </div>
      <div className="ambient-layer" style={depth(8)}>
        <div className="ambient-blob ambient-blob--blush" />
      </div>
    </div>
  );
}
