"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { ThresholdLogo } from "@/components/ThresholdLogo";
import { controlTransition, focusRing } from "@/components/styles";
import { glassButtonClass } from "@/components/ui/GlassButton";
import { ACCOUNTS_URL, LOGIN_URL } from "@/lib/accounts";
import { useAccountSession } from "@/lib/useAccountSession";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Find trials" },
  { href: "/landscape", label: "Landscape" },
  { href: "/map", label: "Map" },
  { href: "/linter", label: "Linter" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// The current page gets a petrol underline, not a pill.
const linkClass =
  `rounded-control px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink ${focusRing} ${controlTransition} ` +
  "aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--accent)]";

/** Log in or Account, based on the accounts app's session cookie. */
function AccountAction({ className = "", onNavigate }: { className?: string; onNavigate?: () => void }) {
  const signedIn = useAccountSession();
  const cls = glassButtonClass("secondary", "sm", `min-w-[5.5rem] ${className}`);

  if (signedIn === null) {
    // Same footprint while the cookie is read, so the header never shifts.
    return <span aria-hidden className={`${cls} pointer-events-none opacity-0`}>Log in</span>;
  }
  // Separate app (accounts/), so a plain <a>, not <Link>.
  return (
    <a href={signedIn ? ACCOUNTS_URL : LOGIN_URL} onClick={onNavigate} className={cls}>
      {signedIn ? "Account" : "Log in"}
    </a>
  );
}

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-page">
      <div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center justify-between gap-3 px-[var(--page-gutter)]">
        <Link href="/" aria-label="Threshold home" className={`rounded-control px-1 py-1 ${focusRing}`}>
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
          <AccountAction className="ml-2" />
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
          className={`grid size-11 place-items-center rounded-control text-ink hover:bg-sunken md:hidden ${focusRing} ${controlTransition}`}
        >
          <MenuIcon open={open} />
        </button>
      </div>

      <div id={menuId} hidden={!open} className="border-t border-line bg-surface px-[var(--page-gutter)] py-2 md:hidden">
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
            <li className="mt-1.5">
              <AccountAction className="min-h-11 w-full" onNavigate={() => setOpen(false)} />
            </li>
          </ul>
        </nav>
      </div>
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
