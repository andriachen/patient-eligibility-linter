import Link from "next/link";
import type { CSSProperties } from "react";

import { HeroModel } from "@/components/landing/HeroModel";
import { eyebrow, focusRing } from "@/components/styles";
import { ArrowIcon, GlassLink } from "@/components/ui/GlassButton";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { Reveal } from "@/components/ui/Reveal";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

const researchLabel = "text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint";

const textLink = `group inline-flex items-center gap-1.5 rounded-md text-[0.95rem] font-semibold text-cobalt hover:text-cobalt-deep ${focusRing}`;

export function LandingExperience() {
  return (
    <main>
      <Hero />
      <Pathways />
    </main>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title">
      <div className="relative mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-y-7 px-[var(--page-gutter)] pb-10 pt-[var(--header-offset)] lg:min-h-[max(44rem,100svh)] lg:grid-cols-12 lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:gap-x-6 lg:gap-y-0 lg:pb-6">
        {/* Upper left: headline, with the primary action directly beneath it. */}
        <div className="relative z-10 text-center lg:col-span-7 lg:row-start-1 lg:text-left">
          <p className={`enter-up ${eyebrow}`} style={delay(200)}>
            Cancer trial access · Massachusetts
          </p>
          <h1
            id="hero-title"
            className="enter-up mt-3 font-serif text-display font-semibold text-ink lg:text-[clamp(3rem,5vw,4.75rem)]"
            style={delay(260)}
          >
            <span className="block">Fair eligibility.</span>
            <span className="block">More possibility.</span>
          </h1>
        </div>

        <div className="relative z-10 hidden lg:pointer-events-none lg:col-span-3 lg:row-start-2 lg:flex lg:items-start lg:pt-7 xl:col-span-2">
          <GlassLink href="/landscape" size="lg" className="enter-up pointer-events-auto" style={delay(380)}>
            Explore trials
            <ArrowIcon />
          </GlassLink>
        </div>

        {/* Right: supporting copy grouped with the research-team action. */}
        <div className="relative z-10 flex justify-center lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:mt-9 lg:block lg:self-start">
          <LiquidGlassPanel
            reflect
            className="enter-up w-full max-w-md px-6 py-5 lg:max-w-[25rem]"
            style={delay(320)}
          >
            <p className="text-center text-[clamp(1.0625rem,0.55rem+0.95vw,1.375rem)] leading-[1.5] text-ink-soft lg:text-left">
              Understand who trial criteria may leave out, and explore opportunities for more
              inclusive research.
            </p>
            <div className="mt-5 hidden flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-4 lg:flex">
              <span className={researchLabel}>For research teams</span>
              <GlassLink href="/linter" variant="secondary" size="md">
                Try the linter
                <ArrowIcon />
              </GlassLink>
            </div>
          </LiquidGlassPanel>
        </div>

        {/* Where the model is framed on desktop; the canvas itself fills the hero. */}
        <div
          id="hero-model-slot"
          aria-hidden
          className="pointer-events-none hidden lg:mt-6 lg:col-span-6 lg:col-start-4 lg:row-span-2 lg:row-start-2 lg:block xl:col-span-8 xl:col-start-3"
        />

        <HeroModel
          slotId="hero-model-slot"
          className="relative h-[min(84vw,24rem)] sm:h-[28rem] lg:absolute lg:inset-0 lg:h-auto"
        />

        {/* Mobile and tablet actions, after the model in reading order. */}
        <div
          className="enter-up relative z-10 flex flex-col items-center gap-4 lg:hidden"
          style={delay(420)}
        >
          <GlassLink href="/landscape" size="lg">
            Explore trials
            <ArrowIcon />
          </GlassLink>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className={researchLabel}>For research teams</span>
            <GlassLink href="/linter" variant="secondary">
              Try the linter
              <ArrowIcon />
            </GlassLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pathways() {
  return (
    <section
      aria-labelledby="pathways-title"
      className="mx-auto w-full max-w-6xl px-[var(--page-gutter)] pb-24 pt-16 lg:pb-28 lg:pt-24"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <Reveal>
          <p className={eyebrow}>How Threshold works</p>
          <h2 id="pathways-title" className="mt-4 font-serif text-title font-semibold text-ink">
            Public trial data, read with care.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft">
            Threshold reads the eligibility criteria of recruiting cancer trials in
            Massachusetts and sets them beside county health and community data.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
            Everything here is information to review with a care or protocol team. It is not
            a decision about who can enroll.
          </p>
          <a
            rel="ar"
            href="/models/landing2.usdz"
            className={`mt-6 inline-flex rounded-md text-sm font-medium text-cobalt hover:text-cobalt-deep ${focusRing}`}
          >
            View the 3D scene in AR (iPhone and iPad)
          </a>
        </Reveal>

        <div className="border-t border-line">
          <Reveal delay={80} className="border-b border-line py-9">
            <p className="text-sm font-semibold tabular-nums text-ink-faint">01</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-ink">
              Explore trial access
            </h3>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-soft">
              See which eligibility criteria appear most often across recruiting trials, and
              how they line up with county health data.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
              <Link href="/landscape" className={textLink}>
                Trial landscape
                <ArrowIcon />
              </Link>
              <Link href="/map" className={textLink}>
                County map
                <ArrowIcon />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={160} className="border-b border-line py-9">
            <p className="text-sm font-semibold tabular-nums text-ink-faint">
              02 · For research teams
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-ink">
              Review eligibility criteria
            </h3>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-soft">
              Paste draft criteria to flag restrictive language and see suggested alternatives
              to discuss with your team.
            </p>
            <div className="mt-5">
              <Link href="/linter" className={textLink}>
                Open the linter
                <ArrowIcon />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
