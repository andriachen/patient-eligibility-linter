"use client";

import { useId, useState, type CSSProperties } from "react";

import { DemoDataBadge, GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassTextarea } from "@/components/ui/GlassField";
import { GlassTabs, tabPanelProps, type GlassTab } from "@/components/ui/GlassTabs";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { categoryLabel } from "@/lib/categories";
import type { LintContext } from "@/lib/lintContext";
import { mockLintCriteria, type LintFlag, type LintResult } from "@/lib/mockLint";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

type ResultTab = "flags" | "impact";

/** What to fix first: 1 = blanket rule guidance says to loosen, 2 = drug-dependent, 3 = team's call. */
type Tier = 1 | 2 | 3;
const TIERS: Tier[] = [1, 2, 3];
const TIER1_CATEGORIES = new Set(["hiv", "brain_mets", "prior_malignancy", "age"]);
const TIER2_CATEGORIES = new Set(["renal", "hepatic", "cardiac", "performance_status"]);

function tierOf(flag: LintFlag): Tier {
  // A conditional rule in a Tier 1 category already uses inclusive wording.
  if (TIER1_CATEGORIES.has(flag.category)) return flag.absolute ? 1 : 2;
  if (TIER2_CATEGORIES.has(flag.category)) return 2;
  return 3;
}

const TIER_HEADINGS: Record<Tier, string> = {
  1: "Fix first: blanket rules that FDA or ASCO–Friends guidance says to loosen",
  2: "Worth a look: the right cutoff depends on the drug",
  3: "Team's call: weaker or draft guidance only",
};

const TEAM_CALL_NOTES: Record<string, string> = {
  pregnancy: "Often required when the drug may harm a fetus. ICH E21 (draft) encourages informed inclusion where it is safe.",
  language: "Affects limited-English communities. FDA recommends translated materials and interpreters.",
  diabetes: "Check whether this is needed for this drug's safety.",
  bmi: "Check whether this is needed for this drug's safety.",
  smoking: "Check whether this is needed for this drug's safety.",
};

// The demo criteria from docs/pitch.md (written for the demo, not from a real trial).
const SAMPLE = `Inclusion Criteria:
* Age 18 to 75 years
* ECOG performance status 0-1
* Creatinine clearance >= 60 mL/min
* Must be able to read and speak English

Exclusion Criteria:
* Known HIV infection
* Brain metastases, treated or untreated
* Any prior malignancy within 5 years
* Pregnant or breastfeeding`;

export function LinterPanel({ context }: { context: LintContext }) {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<LintResult | null>(null);
  const [lastRunText, setLastRunText] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ResultTab>("flags");
  const [copyStatus, setCopyStatus] = useState<{ category: string; ok: boolean } | null>(null);
  const errorId = useId();

  async function copyReplacement(category: string, replacement: string) {
    try {
      await navigator.clipboard.writeText(replacement);
      setCopyStatus({ category, ok: true });
    } catch {
      setCopyStatus({ category, ok: false });
    }
    window.setTimeout(() => setCopyStatus((s) => (s?.category === category ? null : s)), 2000);
  }

  function runLint() {
    if (!text.trim()) {
      setError("Paste eligibility criteria before running the linter.");
      return;
    }
    setError("");
    setResult(mockLintCriteria(text));
    setLastRunText(text);
    setTab("flags");
  }

  const stale = result !== null && text !== lastRunText;

  // How this draft compares: the same keyword rules, run on every recruiting MA trial.
  const histogram = context.flagHistogram;
  const trialsScored = histogram.reduce((a, b) => a + b, 0);
  const flagCount = result?.flags.length ?? 0;
  const fewer = histogram.slice(0, flagCount).reduce((a, b) => a + b, 0);
  let median = 0;
  for (let n = 0, seen = 0; n < histogram.length; n++) {
    seen += histogram[n];
    if (seen >= trialsScored / 2) {
      median = n;
      break;
    }
  }
  // Flags sorted by tier, keeping text order within a tier. A copy: result.flags is untouched.
  const tiered = (result?.flags ?? [])
    .map((flag, i) => ({ flag, i, tier: tierOf(flag) }))
    .sort((a, b) => a.tier - b.tier || a.i - b.i);
  const fixFirst = tiered.filter((t) => t.tier === 1).length;

  const tabs: GlassTab<ResultTab>[] = [
    { id: "flags", label: `Flags${result ? ` (${result.flags.length})` : ""}` },
    { id: "impact", label: "Impact" },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LiquidGlassPanel
        className="enter-up p-5 sm:p-6 lg:sticky lg:top-[calc(var(--header-offset)+0.5rem)]"
        style={delay(140)}
      >
        <section aria-labelledby="criteria-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="criteria-title" className="text-lg font-semibold text-ink">
                Eligibility criteria
              </h2>
              <p className="mt-1 text-sm text-ink-soft">Paste inclusion or exclusion text.</p>
            </div>
            <DemoDataBadge label="Keyword rules" />
          </div>

          <label htmlFor="criteria" className="sr-only">
            Paste eligibility criteria
          </label>
          <GlassTextarea
            id="criteria"
            className="mt-4 min-h-64 lg:min-h-80"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <GlassButton onClick={runLint}>Run linter</GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => setText("")}
              disabled={!text}
            >
              Clear
            </GlassButton>
            <span className="ml-auto text-xs tabular-nums text-ink-faint">
              {text.length.toLocaleString()} characters
            </span>
          </div>

          {error ? (
            <p
              id={errorId}
              role="alert"
              className="mt-3 rounded-xl bg-blush/80 px-3.5 py-2.5 text-sm font-medium text-rose-deep ring-1 ring-rose/20"
            >
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Flags come from keyword rules for 13 categories, checked line by line. Suggestions follow FDA
            eligibility guidance (2020–2026), ICH E21 (draft), and ASCO–Friends recommendations. They are for
            protocol teams to review, not decisions.
          </p>
        </section>
      </LiquidGlassPanel>

      <LiquidGlassPanel className="enter-up p-5 sm:p-6" style={delay(200)}>
        <section aria-labelledby="results-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-title" className="text-lg font-semibold text-ink">
              Results
            </h2>
            {result && result.flags.length > 0 ? (
              <GlassTabs
                idBase="lint-results"
                label="Linter results"
                tabs={tabs}
                value={tab}
                onChange={setTab}
              />
            ) : null}
          </div>

          {result && flagCount > 0 && trialsScored > 0 ? (
            <div className="mt-4 rounded-2xl bg-ice/70 px-4 py-3 ring-1 ring-cobalt/15 text-sm leading-relaxed text-ink">
              This draft restricts <span className="font-semibold">{flagCount} of 13</span> categories (
              {result.flags.filter((f) => f.absolute).length} outright). That&apos;s more than{" "}
              <span className="text-base font-semibold tabular-nums text-cobalt-deep">
                {Math.floor((100 * fewer) / trialsScored)}%
              </span>{" "}
              of {trialsScored.toLocaleString()} recruiting Massachusetts cancer trials (median: {median}), using the
              same keyword rules on each trial&apos;s criteria.{" "}
              <span className="font-semibold">{fixFirst} to fix first.</span>
            </div>
          ) : null}

          {stale ? (
            <p className="mt-3 text-sm text-ink-soft">
              The criteria changed since this run. Run the linter again to update.
            </p>
          ) : null}

          {!result ? (
            <div className="glass-inset mt-4 grid min-h-64 place-items-center px-6 py-10 text-center lg:min-h-80">
              <div className="max-w-xs">
                <p className="font-semibold text-ink">No results yet</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  Run the linter to see flagged criteria and suggested alternatives.
                </p>
              </div>
            </div>
          ) : result.flags.length === 0 ? (
            <div className="glass-inset mt-4 grid min-h-64 place-items-center px-6 py-10 text-center lg:min-h-80">
              <div className="max-w-xs">
                <p className="font-semibold text-ink">No restrictive criteria found</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  None of the 13 categories (age, organ function, HIV, brain metastases, language and
                  more) matched. Review the text by hand too: keyword rules can miss unusual wording.
                </p>
              </div>
            </div>
          ) : tab === "flags" ? (
            <div {...tabPanelProps("lint-results", "flags")} className="mt-4 space-y-5 focus:outline-none">
              {TIERS.map((tier) => {
                const group = tiered.filter((t) => t.tier === tier);
                if (group.length === 0) return null;
                return (
                  <section key={tier} aria-labelledby={`lint-tier-${tier}`}>
                    <h3 id={`lint-tier-${tier}`} className="text-sm font-semibold text-ink">
                      {TIER_HEADINGS[tier]}
                    </h3>
                    <ul className="mt-2 space-y-3">
                      {group.map(({ flag, i }) => {
                        const replacement = flag.replacement;
                        const peers = context.peerConditionalCount[flag.category] ?? 0;
                        const copied = copyStatus?.category === flag.category ? copyStatus : null;
                        const note = tier === 3 ? TEAM_CALL_NOTES[flag.category] : undefined;
                        return (
                          <li key={`${flag.category}-${i}`} className="glass-inset p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <GlassBadge tone="cobalt">{categoryLabel(flag.category)}</GlassBadge>
                              <GlassBadge tone={flag.absolute ? "rose" : "neutral"}>
                                {flag.absolute ? "Absolute" : "Conditional"}
                              </GlassBadge>
                              {flag.threshold ? <GlassBadge tone="neutral">{flag.threshold}</GlassBadge> : null}
                              <span className="text-xs font-medium capitalize text-ink-faint">{flag.section}</span>
                            </div>
                            <blockquote className="mt-3 border-l-2 border-periwinkle pl-3 text-sm leading-relaxed text-ink-soft">
                              {flag.source_text}
                            </blockquote>
                            <p className="mt-3 text-sm leading-relaxed text-ink">
                              <span className="font-semibold">Suggestion:</span> {flag.suggestion}
                            </p>
                            <p className="mt-1.5 text-xs text-ink-faint">
                              Source: {flag.suggestion_source || "no FDA or ASCO–Friends guidance covers this category"}
                            </p>
                            {replacement ? (
                              <div className="mt-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-ink-faint">
                                    {peers > 0
                                      ? `Wording already used by ${peers.toLocaleString()} Massachusetts ${peers === 1 ? "trial" : "trials"}:`
                                      : "Standard NCI wording:"}
                                  </p>
                                  <GlassButton
                                    variant="ghost"
                                    size="sm"
                                    aria-live="polite"
                                    onClick={() => copyReplacement(flag.category, replacement)}
                                  >
                                    {copied ? (copied.ok ? "Copied" : "Couldn't copy") : "Copy"}
                                  </GlassButton>
                                </div>
                                <blockquote className="mt-1.5 border-l-2 border-periwinkle pl-3 text-sm leading-relaxed text-ink-soft">
                                  {replacement}
                                </blockquote>
                              </div>
                            ) : null}
                            {note ? <p className="mt-2 text-xs leading-relaxed text-ink-soft">{note}</p> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <div {...tabPanelProps("lint-results", "impact")} className="mt-4 focus:outline-none">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  How common each flagged restriction is across {context.totalTrials.toLocaleString()} recruiting
                  Massachusetts cancer trials, and, where county data exists (diabetes, BMI, smoking, language),
                  who it could leave out.
                </p>
                {context.source === "mock" ? <DemoDataBadge label="Mock data" /> : null}
              </div>
              <ul className="mt-3 space-y-3">
                {result.flags.map((flag) => {
                  const population = context.population[flag.category];
                  const trialPct = context.trialPctByCategory[flag.category];
                  return (
                    <li key={flag.category} className="glass-inset p-4 text-sm">
                      <p className="font-semibold text-ink">{categoryLabel(flag.category)}</p>
                      {trialPct !== undefined ? (
                        <p className="mt-1 text-ink-soft">
                          <span className="font-semibold tabular-nums text-ink">{trialPct}%</span> of recruiting
                          MA cancer trials also restrict this.
                        </p>
                      ) : null}
                      {population && population.counties.length > 0 ? (
                        <>
                          <p className="mt-3 text-xs font-medium text-ink-faint">
                            {population.measure}, highest counties ({population.source})
                          </p>
                          <ul className="mt-1.5 divide-y divide-line">
                            {population.counties.map((row) => (
                              <li key={row.county} className="flex items-center justify-between py-1.5">
                                <span className="text-ink">{row.county}</span>
                                <span className="font-semibold tabular-nums text-ink">{row.pct}%</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Each measure stands alone. CDC PLACES reports how common each condition is, not how they
                overlap, so these numbers aren&apos;t added together.
              </p>
            </div>
          )}
        </section>
      </LiquidGlassPanel>
    </div>
  );
}
