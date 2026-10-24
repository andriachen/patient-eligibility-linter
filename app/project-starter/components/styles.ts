// Shared styles (aligned with accounts/src/components/styles.ts + liquid glass).

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${buttonBase} bg-brand text-brand-foreground shadow-sm hover:opacity-90`,
  secondary: `${buttonBase} border border-border bg-card text-foreground hover:bg-background`,
  ghost: `${buttonBase} text-muted hover:text-foreground`,
  glass: `${buttonBase} border border-white/30 bg-white/15 text-white backdrop-blur-xl hover:bg-white/25`,
};

export const card =
  "rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8";

/** Clear liquid glass: light tint, edge highlights, gentle blur. */
export const glassPanel =
  "rounded-[1.75rem] border border-white/60 bg-white/20 backdrop-blur-md backdrop-saturate-150 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.25),0_10px_30px_rgba(30,64,175,0.12)]";

export const glassBar =
  "border border-white/60 bg-white/30 backdrop-blur-md backdrop-saturate-150 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_20px_rgba(30,64,175,0.1)]";

export const input =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
