"use client";

import { useRef, type ComponentPropsWithoutRef, type PointerEvent } from "react";

export type GlassLevel = "float" | "panel" | "inset";

type Props = ComponentPropsWithoutRef<"div"> & {
  /** float: nav + small floating controls; panel: main content; inset: nested surfaces. */
  level?: GlassLevel;
  /** Pointer-following highlight on hover (float/panel only). */
  reflect?: boolean;
};

const LEVEL_CLASS: Record<GlassLevel, string> = {
  float: "glass-float",
  panel: "glass-panel",
  inset: "glass-inset",
};

export function LiquidGlassPanel({
  level = "panel",
  reflect = false,
  className = "",
  onPointerMove,
  children,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reflective = reflect && level !== "inset";

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event);
    const el = ref.current;
    if (!reflective || !el || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glass-x", `${event.clientX - rect.left}px`);
    el.style.setProperty("--glass-y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      data-reflect={reflective ? "" : undefined}
      onPointerMove={handlePointerMove}
      className={`${LEVEL_CLASS[level]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
