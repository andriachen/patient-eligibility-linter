"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { StageShareLogo } from "@/components/StageShareLogo";

const links = [
  { href: "/", label: "Home" },
  { href: "/landscape", label: "Landscape" },
  { href: "/map", label: "Map" },
  { href: "/linter", label: "Linter" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="rounded-md outline-offset-2 hover:opacity-90">
          <StageShareLogo showTagline />
        </Link>
        <nav className="flex gap-1 rounded-lg bg-[var(--background)] p-1" aria-label="Main">
          {links.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--brand-primary)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:bg-white hover:text-[var(--brand-primary)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
