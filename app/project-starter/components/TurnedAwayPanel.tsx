"use client";

import Link from "next/link";
import { useState } from "react";

import { focusRing } from "@/components/styles";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassField, GlassInput, GlassSelect } from "@/components/ui/GlassField";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import type { FunnelTrial, TurnedAwayData } from "@/lib/turnedAway";

type Trait = "hiv" | "language" | "brain_mets" | "prior_malignancy" | "performance_status" | "renal" | "hepatic" | "cardiac" | "pregnancy";

/**
 * Funnel steps, in order. `label` finishes "don't restrict ..."; `trait` is the checkbox text.
 * `outright` traits describe a controlled condition, so only outright rules remove the trial:
 * conditional ones ("eligible if viral load is undetectable", "if treated and stable") admit them.
 * For brain metastases, rules aimed only at active disease admit them too (lib/traitRules.ts),
 * the same test Find trials uses.
 */
const TRAITS: { key: Trait; trait: string; label: string; outright?: true }[] = [
  { key: "hiv", trait: "HIV, controlled on treatment", label: "HIV", outright: true },
  { key: "language", trait: "Limited English", label: "language (e.g. English only)" },
  { key: "brain_mets", trait: "Brain metastases, treated and stable", label: "brain metastases", outright: true },
  { key: "prior_malignancy", trait: "Another cancer in the last 5 years", label: "a prior cancer" },
  { key: "performance_status", trait: "ECOG 2 (up and about, can't work)", label: "ECOG 2 (cap at 0–1)" },
  { key: "renal", trait: "Kidney condition", label: "kidney function" },
  { key: "hepatic", trait: "Liver condition", label: "liver function" },
  { key: "cardiac", trait: "Heart condition", label: "heart conditions" },
  { key: "pregnancy", trait: "Pregnant or breastfeeding", label: "pregnancy or breastfeeding" },
];

const PITCH_PATIENT = { county: "25013", age: "58", traits: ["hiv", "language"] as Trait[] };

/** Does this trial's text restrict someone with this trait? */
function restricts(trial: FunnelTrial, trait: Trait, outrightOnly: boolean) {
  if (trait === "performance_status") return trial.ecogMax !== null && trial.ecogMax < 2;
  const rule = trial.r[trait];
  return outrightOnly || TRAITS.find((t) => t.key === trait)?.outright ? rule === "a" : rule !== undefined;
}

/** Interactive funnel: how many recruiting trials are left as a person's traits are added. */
export function TurnedAwayPanel({ data }: { data: TurnedAwayData }) {
  const [county, setCounty] = useState(PITCH_PATIENT.county);
  const [age, setAge] = useState(PITCH_PATIENT.age);
  const [traits, setTraits] = useState<Trait[]>(PITCH_PATIENT.traits);
  const [outrightOnly, setOutrightOnly] = useState(false);

  const ageNum = Number(age);
  const validAge = age.trim() !== "" && Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 120;
  const countyName = county === "all" ? "Massachusetts" : (data.counties.find((c) => c.fips === county)?.name ?? county);
  const examples = data.examples[county] ?? {};

  let pool = data.trials.filter((t) => county === "all" || t.fips.includes(county));
  const steps: { label: string; count: number; removed: number; trait?: Trait; removedIds?: Set<string> }[] = [
    { label: `Recruiting cancer trials in ${county === "all" ? "Massachusetts" : `${countyName} County`}`, count: pool.length, removed: 0 },
  ];
  if (validAge) {
    const before = pool.length;
    pool = pool.filter((t) => (t.minAge === null || t.minAge <= ageNum) && (t.maxAge === null || t.maxAge >= ageNum));
    steps.push({ label: `Accept a ${ageNum}-year-old`, count: pool.length, removed: before - pool.length });
  }
  for (const { key, label, outright } of TRAITS) {
    if (!traits.includes(key)) continue;
    const removedIds = new Set(pool.filter((t) => restricts(t, key, outrightOnly)).map((t) => t.id));
    pool = pool.filter((t) => !removedIds.has(t.id));
    steps.push({
      label: outright ? `Don't exclude ${label} outright` : `Don't restrict ${label}`,
      count: pool.length,
      removed: removedIds.size,
      trait: key,
      removedIds,
    });
  }
  const start = steps[0].count || 1;

  const toggle = (key: Trait) =>
    setTraits((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  return (
    <LiquidGlassPanel className="p-5 sm:p-6">
      <section aria-labelledby="turned-away-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 id="turned-away-title" className="text-xl font-semibold tracking-[-0.02em] text-ink">
              Who gets turned away
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Pick a county and a person. Each step drops the trials whose eligibility criteria restrict that
              trait, with the exact sentences that do it.
            </p>
          </div>
          <GlassButton
            variant="secondary"
            size="sm"
            className="max-w-full whitespace-normal! text-left"
            onClick={() => {
              setCounty(PITCH_PATIENT.county);
              setAge(PITCH_PATIENT.age);
              setTraits(PITCH_PATIENT.traits);
              setOutrightOnly(false);
            }}
          >
            Example: 58, controlled HIV, limited English, Hampden
          </GlassButton>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <GlassField label="County">
              <GlassSelect value={county} onChange={(e) => setCounty(e.target.value)}>
                <option value="all">All of Massachusetts</option>
                {data.counties.map((c) => (
                  <option key={c.fips} value={c.fips}>
                    {c.name}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
            <GlassField label="Age" hint={validAge ? undefined : "Enter an age from 0 to 120 to apply age limits."}>
              <GlassInput inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className="max-w-28" />
            </GlassField>
            <fieldset>
              <legend className="text-[0.8rem] font-semibold text-ink-soft">The person has</legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {TRAITS.map(({ key, trait }) => (
                  <label key={key} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={traits.includes(key)}
                      onChange={() => toggle(key)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--cobalt)]"
                    />
                    {trait}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-2.5 border-t border-line pt-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={outrightOnly}
                onChange={(e) => setOutrightOnly(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--cobalt)]"
              />
              Count only rules that exclude outright (ignore conditional ones, such as a time window for a prior
              cancer)
            </label>
          </div>

          <div>
            <ol className="flex flex-col gap-3" aria-label={`Funnel for ${countyName}`}>
              {steps.map((step, i) => (
                <li key={step.label} className="glass-inset p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{step.label}</span>
                    <span className="shrink-0 text-lg font-semibold tabular-nums text-ink">
                      {step.count.toLocaleString()}
                      {i > 0 ? (
                        <span className="ml-2 font-sans text-xs font-medium text-ink-soft">
                          {step.removed > 0 ? `−${step.removed}` : "no change"}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-2 glass-inset h-2 overflow-hidden rounded-full" aria-hidden>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(step.count / start) * 100}%`, background: "linear-gradient(90deg, var(--chart-bar-soft), var(--chart-bar))" }}
                    />
                  </div>
                  {step.trait && step.removedIds ? (
                    <ul className="mt-2.5 space-y-1.5 empty:hidden">
                      {(examples[step.trait] ?? [])
                        .filter((ex) => step.removedIds?.has(ex.id))
                        .slice(0, 2)
                        .map((ex) => (
                        <li key={ex.id} className="border-l-2 border-periwinkle pl-2.5 text-xs leading-relaxed text-ink-soft">
                          &ldquo;{ex.text}&rdquo;{" "}
                          <Link
                            href={`/trial/${ex.id}`}
                            prefetch={false}
                            className={`font-mono text-[0.7rem] text-cobalt underline-offset-2 hover:underline ${focusRing}`}
                          >
                            {ex.id}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              Criteria alone: cancer type, stage and lab values aren&apos;t considered, so this counts trials whose
              text restricts each trait, not eligibility decisions. Sources: ClinicalTrials.gov eligibility criteria
              for recruiting trials with a Massachusetts site, extracted by our model (F1 0.95 on held-out
              hand-labeled trials) with every rule quoted.
            </p>
          </div>
        </div>
      </section>
    </LiquidGlassPanel>
  );
}
