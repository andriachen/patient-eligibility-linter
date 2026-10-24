import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "cobalt" | "rose" | "demo";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft ring-line",
  cobalt: "bg-accent-tint text-accent-strong ring-accent/20",
  rose: "bg-alert-tint text-alert ring-alert/25",
  demo: "bg-transparent text-ink-soft ring-line-strong",
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ring-1 ${TONE[tone]} ${className}`}
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
