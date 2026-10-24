/** Blue heart mark on an ink tile + Threshold wordmark. One flat accent colour; no
 *  gradients, no ornamental dots, so it reads the same on any white background. */
export function ThresholdLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden className="shrink-0">
        <rect width="40" height="40" rx="11" fill="var(--ink)" />
        <path
          d="M28 11c-2 0-4 1.2-5 3.1-1-1.9-3-3.1-5-3.1-3.3 0-6 2.7-6 6 0 5.5 11 13 11 13s11-7.5 11-13c0-3.3-2.7-6-6-6z"
          fill="var(--cobalt)"
          transform="translate(-2 2) scale(0.72)"
        />
      </svg>
      <span className="text-[0.95rem] font-semibold tracking-[-0.01em] text-ink">Threshold</span>
    </span>
  );
}
