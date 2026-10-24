import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { eyebrow, focusRing } from "@/components/styles";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { categoryLabel } from "@/lib/categories";
import { locateQuote } from "@/lib/criteriaText";
import { loadTrialDetails, trialIds } from "@/lib/loadTrialDetails";

// One static page per recruiting trial; Vercel never reads the data at request time.
export const dynamicParams = false;

export function generateStaticParams() {
  return trialIds().map((nct) => ({ nct }));
}

type Params = { params: Promise<{ nct: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { nct } = await params;
  return { title: `${nct} · Threshold` };
}

type Mark = { start: number; end: number; anchor: string; categories: string[]; absolute: boolean };

const ages = (min: number | null, max: number | null) =>
  min === null && max === null ? "Any age" : `${min ?? 0}${max === null ? "+" : `–${max}`} years`;

export default async function TrialPage({ params }: Params) {
  const { nct } = await params;
  const trial = loadTrialDetails(nct);
  if (!trial) notFound();
  const text = trial.eligibility;

  // Highlight every extracted quote. Rows quoting the same sentence share one mark.
  const marks: Mark[] = [];
  const anchorFor = trial.exclusions.map((e) => {
    const span = locateQuote(text, e.source_text);
    if (!span) return null;
    const hit = marks.find((m) => span.start < m.end && span.end > m.start);
    if (hit) {
      if (!hit.categories.includes(e.category)) hit.categories.push(e.category);
      hit.absolute ||= e.absolute;
      hit.start = Math.min(hit.start, span.start);
      hit.end = Math.max(hit.end, span.end);
      return hit.anchor;
    }
    const anchor = `q${marks.length + 1}`;
    marks.push({ ...span, anchor, categories: [e.category], absolute: e.absolute });
    return anchor;
  });
  marks.sort((a, b) => a.start - b.start);

  const parts: ReactNode[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.start > pos) parts.push(text.slice(pos, m.start));
    parts.push(
      <mark
        key={m.anchor}
        id={m.anchor}
        className={`scroll-mt-[calc(var(--header-offset)+1rem)] rounded-md px-0.5 text-ink ${
          m.absolute ? "bg-blush" : "bg-ice"
        }`}
      >
        {text.slice(m.start, m.end)}
        <span className="ml-1 whitespace-nowrap rounded-full bg-white/80 px-1.5 align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-ink-soft ring-1 ring-line">
          {m.categories.map(categoryLabel).join(" · ")}
        </span>
      </mark>,
    );
    pos = m.end;
  }
  parts.push(text.slice(pos));

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-3xl">
        <Link href="/landscape" className={`text-sm text-ink-soft hover:text-ink ${focusRing}`}>
          ← Landscape
        </Link>
        <p className={`${eyebrow} mt-4`}>Trial {trial.nct_id}</p>
        <h1 className="mt-2 text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)] font-semibold leading-tight tracking-[-0.03em] text-ink">
          {trial.title}
        </h1>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-ink-faint">Phase</dt>
          <dd className="text-ink">{trial.phase || "Not given"}</dd>
          <dt className="text-ink-faint">Sponsor</dt>
          <dd className="text-ink">{trial.lead_sponsor}</dd>
          <dt className="text-ink-faint">Conditions</dt>
          <dd className="text-ink">{trial.conditions.join("; ")}</dd>
          <dt className="text-ink-faint">Ages</dt>
          <dd className="text-ink">{ages(trial.min_age, trial.max_age)}</dd>
        </dl>
        <a
          href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
          target="_blank"
          rel="noreferrer"
          className={`mt-4 inline-block text-sm font-semibold text-cobalt underline-offset-2 hover:underline ${focusRing}`}
        >
          View on ClinicalTrials.gov ↗
        </a>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <LiquidGlassPanel className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Eligibility criteria</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Highlighted: restrictions our model extracted, each a verbatim quote (pink = excludes outright, blue =
            only under conditions).
          </p>
          <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{parts}</div>
        </LiquidGlassPanel>

        <div className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--header-offset)+0.5rem)] lg:max-h-[calc(100dvh-var(--header-offset)-1rem)] lg:overflow-y-auto">
          <LiquidGlassPanel className="p-5">
            <h2 className="text-base font-semibold text-ink">
              Restrictions found <span className="text-ink-faint">({trial.exclusions.length})</span>
            </h2>
            {trial.exclusions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">None of the 13 categories were found in this trial&apos;s criteria.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {trial.exclusions.map((e, i) => (
                  <li key={`${e.category}-${i}`} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <GlassBadge tone="cobalt">{categoryLabel(e.category)}</GlassBadge>
                      <GlassBadge tone={e.absolute ? "rose" : "neutral"}>{e.absolute ? "Absolute" : "Conditional"}</GlassBadge>
                      <span className="text-xs capitalize text-ink-faint">{e.section}</span>
                    </div>
                    {e.threshold ? <p className="mt-1 text-ink-soft">{e.threshold}</p> : null}
                    {anchorFor[i] ? (
                      <a href={`#${anchorFor[i]}`} className={`mt-1 inline-block text-xs text-cobalt hover:underline ${focusRing}`}>
                        Show in the text
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </LiquidGlassPanel>

          <LiquidGlassPanel className="p-5">
            <h2 className="text-base font-semibold text-ink">Recruiting in Massachusetts</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {trial.sites.map((s, i) => (
                <li key={`${s.facility}-${i}`}>
                  <span className="text-ink">{s.facility}</span>
                  <span className="text-ink-faint">
                    {" "}
                    · {s.city}, {s.county} County
                  </span>
                </li>
              ))}
            </ul>
          </LiquidGlassPanel>
        </div>
      </div>
    </div>
  );
}
