"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { ThresholdLogo } from "@/components/ThresholdLogo";
import { controlTransition, focusRing } from "@/components/styles";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/landscape", label: "Landscape" },
  { href: "/map", label: "Map" },
  { href: "/matches", label: "Find Trials" },
  { href: "/linter", label: "Linter" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const linkClass =
  `rounded-full px-4 py-2 text-sm font-medium text-ink/70 hover:bg-white/55 hover:text-ink ${focusRing} ${controlTransition} ` +
  "aria-[current=page]:bg-white/75 aria-[current=page]:font-semibold aria-[current=page]:text-ink " +
  "aria-[current=page]:shadow-[inset_0_1px_2px_rgb(23_36_71/0.08),inset_0_0_0_1px_rgb(23_36_71/0.06),0_1px_0_rgb(255_255_255/0.9)]";

/** The one header used on every route. Lives in the root layout, so it never remounts. */
export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-[var(--header-top)] z-50 px-3 sm:px-6">
      <LiquidGlassPanel
        level="float"
        reflect
        className="enter-nav pointer-events-auto mx-auto flex h-[var(--header-height)] max-w-[68rem] items-center justify-between gap-3 pl-2 pr-2"
      >
        <Link href="/" aria-label="Threshold home" className={`rounded-full px-1.5 py-1 ${focusRing}`}>
          <ThresholdLogo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={linkClass}
            >
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
          className={`grid size-11 place-items-center rounded-full text-ink hover:bg-white/60 md:hidden ${focusRing} ${controlTransition}`}
        >
          <MenuIcon open={open} />
        </button>
      </LiquidGlassPanel>

      <LiquidGlassPanel
        id={menuId}
        hidden={!open}
        level="panel"
        className="pointer-events-auto mx-auto mt-2 max-w-[68rem] rounded-[1.5rem] bg-white/80 p-2 md:hidden"
      >
        <nav aria-label="Mobile">
          <ul className="flex flex-col gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center ${linkClass}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </LiquidGlassPanel>
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      {open ? (
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M3.5 7h13M3.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
