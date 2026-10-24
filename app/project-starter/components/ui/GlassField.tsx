import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { controlTransition } from "@/components/styles";

const control =
  `glass-inset w-full rounded-control text-[0.95rem] text-ink placeholder:text-ink-faint ${controlTransition} ` +
  "hover:bg-white/70 focus:bg-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/70 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Label + control + optional hint, stacked. */
export function GlassField({ label, hint, children, className = "" }: FieldProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[0.8rem] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function GlassInput({ className = "", ...rest }: ComponentPropsWithoutRef<"input">) {
  return <input className={`${control} min-h-11 px-3.5 ${className}`} {...rest} />;
}

export function GlassTextarea({ className = "", ...rest }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={`${control} min-h-48 resize-y px-4 py-3.5 leading-relaxed ${className}`}
      {...rest}
    />
  );
}

export function GlassSelect({ className = "", children, ...rest }: ComponentPropsWithoutRef<"select">) {
  return (
    <span className={`relative block ${className}`}>
      <select className={`${control} min-h-11 cursor-pointer appearance-none pl-3.5 pr-10`} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
