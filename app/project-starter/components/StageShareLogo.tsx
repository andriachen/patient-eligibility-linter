type Props = {
  showTagline?: boolean;
  compact?: boolean;
  /** White text for glass / 3D landing overlays */
  onDark?: boolean;
};

/** Health-themed mark: awareness ribbon + StageShare wordmark. */
export function StageShareLogo({
  showTagline = false,
  compact = false,
  onDark = false,
}: Props) {
  const size = compact ? 32 : 40;

  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="ss-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-primary)" />
            <stop offset="55%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="var(--brand-secondary)" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="var(--brand-primary-dark)" />
        <path
          d="M28 11c-2 0-4 1.2-5 3.1-1-1.9-3-3.1-5-3.1-3.3 0-6 2.7-6 6 0 5.5 11 13 11 13s11-7.5 11-13c0-3.3-2.7-6-6-6z"
          fill="url(#ss-ribbon)"
          transform="translate(-2 2) scale(0.72)"
        />
        <circle cx="30" cy="12" r="3" fill="var(--brand-accent)" opacity="0.9" />
      </svg>
      <div className="leading-tight">
        <span
          className={`font-semibold tracking-tight ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          <span className={onDark ? "text-white" : "text-[var(--brand-primary)]"}>
            Stage
          </span>
          <span className={onDark ? "text-pink-200" : "text-[var(--brand-secondary)]"}>
            Share
          </span>
        </span>
        {showTagline ? (
          <p
            className={`text-[10px] font-medium uppercase tracking-wider ${
              onDark ? "text-white/70" : "text-[var(--text-muted)]"
            }`}
          >
            Cancer trial access
          </p>
        ) : null}
      </div>
    </div>
  );
}
