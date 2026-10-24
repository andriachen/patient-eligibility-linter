"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/landscape", label: "Landscape" },
  { href: "/map", label: "Map" },
  { href: "/linter", label: "Linter" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/landscape" className="text-sm font-semibold tracking-tight">
          Trial Eligibility Linter
        </Link>
        <nav className="flex gap-1" aria-label="Main">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
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
