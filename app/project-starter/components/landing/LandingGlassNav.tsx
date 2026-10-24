import Link from "next/link";

import { glassBar } from "@/components/styles";
import { StageShareLogo } from "@/components/StageShareLogo";
import { LOGIN_URL } from "@/lib/accounts";

const links = [
  { href: "/landscape", label: "Landscape" },
  { href: "/map", label: "Map" },
  { href: "/linter", label: "Linter" },
];

export function LandingGlassNav() {
  return (
    <header
      className={`fixed left-4 right-4 top-4 z-20 mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-2xl px-4 py-3 ${glassBar}`}
    >
      <Link href="/" className="rounded-lg outline-offset-2">
        <StageShareLogo showTagline compact />
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-1" aria-label="Main">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white/40"
          >
            {label}
          </Link>
        ))}
        {/* Separate app (accounts/), so a plain <a>, not <Link>. */}
        <a
          href={LOGIN_URL}
          className="ml-2 rounded-xl border border-white/70 bg-blue-600/85 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:bg-blue-700/90"
        >
          Log in
        </a>
      </nav>
    </header>
  );
}
