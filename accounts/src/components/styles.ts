// Shared Tailwind class lists for buttons and cards.

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${buttonBase} bg-brand text-brand-foreground hover:bg-brand-strong`,
  secondary: `${buttonBase} border border-border bg-card text-foreground hover:bg-background`,
  ghost: `${buttonBase} text-muted hover:text-foreground`,
};

export const card = "rounded-md border border-border bg-card p-6 sm:p-8";

export const input =
  "w-full rounded border border-border-strong bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand";
