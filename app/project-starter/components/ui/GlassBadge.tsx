import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "cobalt" | "rose" | "demo";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-white/70 text-ink-soft ring-ink/10",
  cobalt: "bg-ice/80 text-cobalt-deep ring-cobalt/20",
  rose: "bg-blush/90 text-rose-deep ring-rose/25",
  demo: "bg-lavender/80 text-[#4b3c8f] ring-[#4b3c8f]/20",
};

export function GlassBadge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Standard label for mock or demo data. */
export function DemoDataBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <GlassBadge tone="demo">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </GlassBadge>
  );
}
