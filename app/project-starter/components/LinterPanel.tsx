"use client";

import { useId, useState, type CSSProperties } from "react";

import { DemoDataBadge, GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassTextarea } from "@/components/ui/GlassField";
import { GlassTabs, tabPanelProps, type GlassTab } from "@/components/ui/GlassTabs";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { categoryLabel } from "@/lib/categories";
import type { LintContext } from "@/lib/lintContext";
import { mockLintCriteria, type LintResult } from "@/lib/mockLint";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

type ResultTab = "flags" | "impact";

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
  const errorId = useId();

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
              className="mt-3 rounded-control bg-alert-tint px-3.5 py-2.5 text-sm font-medium text-alert ring-1 ring-alert/20"
            >
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Flags come from keyword rules for the 13 categories, checked line by line. Suggestions and
            sources follow FDA guidance (2020, 2024) and the ASCO–Friends recommendations; they are for
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
            <div className="mt-4 border-l-2 border-accent bg-accent-tint/60 px-4 py-3 text-sm leading-relaxed text-ink">
              This draft restricts <span className="font-semibold">{flagCount} of 13</span> categories (
              {result.flags.filter((f) => f.absolute).length} outright). That&apos;s more than{" "}
              <span className="font-serif text-base font-semibold tabular-nums">
                {Math.floor((100 * fewer) / trialsScored)}%
              </span>{" "}
              of {trialsScored.toLocaleString()} recruiting Massachusetts cancer trials (median: {median}), using the
              same keyword rules on each trial&apos;s criteria.
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
            <ul {...tabPanelProps("lint-results", "flags")} className="mt-4 space-y-3 focus:outline-none">
              {result.flags.map((flag, i) => (
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
                </li>
              ))}
            </ul>
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
