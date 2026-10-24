import { useId } from "react";

/** Health-themed mark (heart ribbon in a rounded tile) + StageShare wordmark. */
export function StageShareLogo() {
  const gradientId = useId();

  return (
    <span className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8ea6f7" />
            <stop offset="55%" stopColor="#c7b8f5" />
            <stop offset="100%" stopColor="#f3a6c6" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="var(--ink)" />
        <path
          d="M28 11c-2 0-4 1.2-5 3.1-1-1.9-3-3.1-5-3.1-3.3 0-6 2.7-6 6 0 5.5 11 13 11 13s11-7.5 11-13c0-3.3-2.7-6-6-6z"
          fill={`url(#${gradientId})`}
          transform="translate(-2 2) scale(0.72)"
        />
        <circle cx="30" cy="12" r="2.6" fill="#f3a6c6" />
      </svg>
      <span className="text-[0.95rem] font-semibold tracking-[-0.01em] text-ink">
        Stage<span className="text-cobalt">Share</span>
      </span>
    </span>
  );
}
