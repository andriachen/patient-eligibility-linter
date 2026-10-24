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
    "bg-cobalt text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_12px_28px_-14px_rgb(53_101_245/0.8)] hover:bg-cobalt-deep",
  secondary:
    "bg-white/80 text-ink shadow-[inset_0_1px_0_rgb(255_255_255),0_8px_20px_-14px_rgb(23_36_71/0.45)] ring-1 ring-ink/10 hover:bg-white",
  ghost: "text-ink-soft hover:bg-white/70 hover:text-ink",
};

/** Class string for any element that should look like a glass button. */
export function glassButtonClass(
  variant: GlassButtonVariant = "primary",
  size: GlassButtonSize = "md",
  className = "",
) {
  return (
    `group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ` +
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
