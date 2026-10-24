/** Threshold mark + wordmark; matches app/project-starter/components/ThresholdLogo.tsx. */
export function ThresholdLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden className="shrink-0">
        <rect x="4" y="3" width="20" height="22" rx="1.5" fill="none" stroke="var(--foreground)" strokeWidth="2" />
        <rect x="1" y="15" width="26" height="3" rx="1" fill="var(--brand)" />
      </svg>
      <span className="font-serif text-[1.05rem] font-semibold tracking-[-0.01em]">Threshold</span>
    </span>
  );
}
