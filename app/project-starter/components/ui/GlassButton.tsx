import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { controlTransition, focusRing } from "@/components/styles";

export type GlassButtonVariant = "primary" | "secondary" | "ghost";
export type GlassButtonSize = "sm" | "md" | "lg";

const SIZE: Record<GlassButtonSize, string> = {
  sm: "min-h-9 px-4 text-sm",
  md: "min-h-11 px-5 text-[0.95rem]",
  lg: "min-h-12 px-6 text-base",
};

const VARIANT: Record<GlassButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-strong",
  secondary:
    "bg-surface text-ink ring-1 ring-line-strong hover:bg-sunken",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
};

/** Class string for any element that should look like a glass button. */
export function glassButtonClass(
  variant: GlassButtonVariant = "primary",
  size: GlassButtonSize = "md",
  className = "",
) {
  return (
    `group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold ` +
    `${SIZE[size]} ${VARIANT[variant]} ${focusRing} ${controlTransition} ` +
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100 " +
    className
  );
}

type Shared = { variant?: GlassButtonVariant; size?: GlassButtonSize };

export function GlassButton({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: ComponentPropsWithoutRef<"button"> & Shared) {
  return <button type={type} className={glassButtonClass(variant, size, className)} {...rest} />;
}

export function GlassLink({
  variant,
  size,
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof Link> & Shared) {
  return <Link className={glassButtonClass(variant, size, className)} {...rest} />;
}

export function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
