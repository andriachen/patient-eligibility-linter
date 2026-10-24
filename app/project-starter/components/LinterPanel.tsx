"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

import { controlTransition, focusRing } from "@/components/styles";
import { DemoDataBadge, GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassTextarea } from "@/components/ui/GlassField";
import { GlassTabs, tabPanelProps, type GlassTab } from "@/components/ui/GlassTabs";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { categoryLabel } from "@/lib/categories";
import { locateQuote, normalizeCriteria } from "@/lib/criteriaText";
import type { LintContext } from "@/lib/lintContext";
import { mockLintCriteria, type LintFlag } from "@/lib/mockLint";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

type ResultTab = "flags" | "draft" | "impact";
type Engine = "model" | "rules";
type Run = { flags: LintFlag[]; engine: Engine; model?: string; notice?: string };

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
const SAMPLE_INCLUSION = `* Age 18 to 75 years
* ECOG performance status 0-1
* Creatinine clearance >= 60 mL/min
* Must be able to read and speak English`;

const SAMPLE_EXCLUSION = `* Known HIV infection
* Brain metastases, treated or untreated
* Any prior malignancy within 5 years
* Pregnant or breastfeeding`;

/**
 * Compose two user inputs into the format the extraction prompt expects. The model's
 * `source_text` must come from a sentence that STATES a restriction and the section
 * is a required field, so we always emit both headers — pasting a bare word like
 * "hiv" into one box lets the model anchor it to the right section.
 */
function compose(inclusion: string, exclusion: string): string {
  const inc = inclusion.trim();
  const exc = exclusion.trim();
  return `Inclusion Criteria:\n\n${inc}\n\nExclusion Criteria:\n\n${exc}`;
}

// Why a Claude run fell back to keyword rules, keyed by the API's error code.
const FALLBACK_NOTICE: Record<string, string> = {
  not_configured: "Claude isn't set up on this server, so these flags come from keyword rules.",
  too_long: "This draft is over 25,000 characters, too long for a live read, so these flags come from keyword rules.",
  rate_limited: "Too many runs in a few minutes, so these flags come from keyword rules. Try Claude again shortly.",
  busy: "Claude is busy right now, so these flags come from keyword rules. Try again in a moment.",
  failed: "Claude couldn't read this draft, so these flags come from keyword rules.",
};

/** "claude-haiku-5-5" -> "Claude Haiku 5.5" */
function modelName(id: string) {
  const [, family = "", ...version] = id.split("-");
  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.join(".")}`.trim();
}

/** Median and "more restrictive than" share for a draft with `count` flags. */
function compare(histogram: number[], count: number) {
  const total = histogram.reduce((a, b) => a + b, 0);
  const fewer = histogram.slice(0, count).reduce((a, b) => a + b, 0);
  let median = 0;
  for (let n = 0, seen = 0; n < histogram.length; n++) {
    seen += histogram[n];
    if (seen >= total / 2) {
      median = n;
      break;
    }
  }
  // Rounded down so "more than" stays true.
  return { total, median, pct: total ? Math.floor((100 * fewer) / total) : 0 };
}

/** Plain-text report a protocol team can paste into a review. */
function reportText(run: Run, comparison: ReturnType<typeof compare>) {
  const engine = run.engine === "model" && run.model ? modelName(run.model) : "keyword rules";
  const lines = [
    `Threshold Linter report (${engine})`,
    `${run.flags.length} of 13 categories restricted (${run.flags.filter((f) => f.absolute).length} outright). ` +
      `More restrictive than ${comparison.pct}% of ${comparison.total} recruiting Massachusetts cancer trials (median: ${comparison.median}).`,
    "",
  ];
  run.flags.forEach((f, i) => {
    lines.push(
      `${i + 1}. ${categoryLabel(f.category)}: ${f.absolute ? "outright" : "conditional"}, ${f.section}${f.threshold ? `, ${f.threshold}` : ""}`,
      `   "${f.source_text}"`,
      `   Suggestion: ${f.suggestion}`,
      ...(f.replacement ? [`   Inclusive wording: "${f.replacement}"`] : []),
      `   Source: ${f.suggestion_source || "no FDA or ASCO-Friends guidance covers this category"}`,
      "",
    );
  });
  return lines.join("\n");
}

export function LinterPanel({ context }: { context: LintContext }) {
  const [inclusion, setInclusion] = useState(SAMPLE_INCLUSION);
  const [exclusion, setExclusion] = useState(SAMPLE_EXCLUSION);
  const [run, setRun] = useState<Run | null>(null);
  const [lastRunText, setLastRunText] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ResultTab>("flags");
  const [engine, setEngine] = useState<Engine>("model");
  const [live, setLive] = useState<{ configured: boolean; model: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const [focus, setFocus] = useState<string | null>(null);
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

  // Ask the server whether Claude is available; without a key the Linter uses keyword rules.
  useEffect(() => {
    fetch("/api/lint")
      .then((r) => (r.ok ? r.json() : null))
      .then((info: { configured: boolean; model: string } | null) => {
        const status = info ?? { configured: false, model: "" };
        setLive(status);
        if (!status.configured) setEngine("rules");
      })
      .catch(() => {
        setLive({ configured: false, model: "" });
        setEngine("rules");
      });
  }, []);

  // "Show in draft" switches tabs; scroll once the highlighted draft has rendered.
  useEffect(() => {
    if (tab !== "draft" || !focus) return;
    document.querySelector(`[data-categories~="${focus}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFocus(null);
  }, [tab, focus]);

  function finish(result: Run, draft: string) {
    setRun(result);
    setLastRunText(draft);
    setTab("flags");
    setCopied("");
  }

  async function runLint() {
    if (!inclusion.trim() && !exclusion.trim()) {
      setError("Paste inclusion or exclusion criteria before running the linter.");
      return;
    }
    setError("");
    const draft = compose(inclusion, exclusion);
    if (engine === "rules") {
      finish({ ...mockLintCriteria(draft), engine: "rules" }, draft);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/lint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data?.flags)) {
        finish({ flags: data.flags, engine: "model", model: data.model }, draft);
      } else {
        const code: string = data?.error ?? "failed";
        if (code === "not_configured") {
          setLive((s) => ({ configured: false, model: s?.model ?? "" }));
          setEngine("rules");
        }
        finish({ ...mockLintCriteria(draft), engine: "rules", notice: FALLBACK_NOTICE[code] ?? FALLBACK_NOTICE.failed }, draft);
      }
    } catch {
      finish({ ...mockLintCriteria(draft), engine: "rules", notice: FALLBACK_NOTICE.failed }, draft);
    } finally {
      setPending(false);
    }
  }

  async function copyReport() {
    if (!run) return;
    try {
      await navigator.clipboard.writeText(reportText(run, comparison));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  const stale = run !== null && compose(inclusion, exclusion) !== lastRunText;
  const flagCount = run?.flags.length ?? 0;
  // Compare like for like: model flags against the model's extraction of every trial,
  // keyword flags against the same rules run on every trial.
  const comparison = compare(run?.engine === "model" ? context.modelHistogram : context.flagHistogram, flagCount);
  const claudeName = live?.model ? modelName(live.model) : "Claude";
  // Flags sorted by tier, keeping text order within a tier.
  const tiered = (run?.flags ?? [])
    .map((flag, i) => ({ flag, i, tier: tierOf(flag) }))
    .sort((a, b) => a.tier - b.tier || a.i - b.i);
  const fixFirst = tiered.filter((t) => t.tier === 1).length;
  const peerCounts = run?.engine === "model" ? context.modelPeerConditionalCount : context.peerConditionalCount;

  const tabs: GlassTab<ResultTab>[] = [
    { id: "flags", label: `Flags${run ? ` (${run.flags.length})` : ""}` },
    { id: "draft", label: "In the draft" },
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
              <p className="mt-1 text-sm text-ink-soft">
                Paste the inclusion and exclusion sections of a draft protocol — one or both.
              </p>
            </div>
            {engine === "model" ? (
              <GlassBadge tone="cobalt">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                {claudeName}
              </GlassBadge>
            ) : (
              <DemoDataBadge label="Keyword rules" />
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="inclusion" className="text-[0.8rem] font-semibold text-ink-soft">
                Inclusion criteria
              </label>
              <p className="text-xs text-ink-faint">Who the trial accepts.</p>
              <GlassTextarea
                id="inclusion"
                className="mt-2 min-h-48 lg:min-h-56"
                placeholder={"* Age 18 to 75 years\n* ECOG performance status 0-1"}
                value={inclusion}
                onChange={(e) => {
                  setInclusion(e.target.value);
                  if (error) setError("");
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <div>
              <label htmlFor="exclusion" className="text-[0.8rem] font-semibold text-ink-soft">
                Exclusion criteria
              </label>
              <p className="text-xs text-ink-faint">Who the trial turns away.</p>
              <GlassTextarea
                id="exclusion"
                className="mt-2 min-h-48 lg:min-h-56"
                placeholder={"* Known HIV infection\n* Brain metastases, treated or untreated"}
                value={exclusion}
                onChange={(e) => {
                  setExclusion(e.target.value);
                  if (error) setError("");
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <GlassButton onClick={runLint} disabled={pending}>
              {pending ? "Reading the criteria…" : "Run linter"}
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => {
                setInclusion("");
                setExclusion("");
              }}
              disabled={(!inclusion && !exclusion) || pending}
            >
              Clear
            </GlassButton>
            <span className="ml-auto text-xs tabular-nums text-ink-faint">
              {(inclusion.length + exclusion.length).toLocaleString()} characters
            </span>
          </div>

          <fieldset className="mt-4">
            <legend className="text-[0.8rem] font-semibold text-ink-soft">Engine</legend>
            <div role="radiogroup" aria-label="Engine" className="glass-inset mt-2 inline-flex gap-1 rounded-full p-1">
              {(
                [
                  ["model", claudeName],
                  ["rules", "Keyword rules"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={engine === id}
                  disabled={(id === "model" && live?.configured === false) || pending}
                  onClick={() => setEngine(id)}
                  className={`min-h-8 rounded-full px-3.5 text-[0.8125rem] font-semibold disabled:opacity-50 ${focusRing} ${controlTransition} ${
                    engine === id
                      ? "bg-white text-ink shadow-[inset_0_1px_0_rgb(255_255_255),0_4px_12px_-6px_rgb(23_36_71/0.3)]"
                      : "text-ink-soft hover:bg-white/60 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {live?.configured === false ? (
              <p className="mt-1.5 text-xs text-ink-faint">
                Claude isn&apos;t set up on this server (it needs an Anthropic API key), so the Linter uses
                keyword rules.
              </p>
            ) : null}
          </fieldset>

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
            {engine === "model" ? (
              <>
                {claudeName} reads the criteria with the same prompt that extracted all{" "}
                {context.totalTrials.toLocaleString()} recruiting trials (F1 0.95 on held-out hand-labeled
                trials). Every flag quotes your text word for word, checked before it&apos;s shown. Your text goes
                to Anthropic&apos;s API; Threshold doesn&apos;t save it.
              </>
            ) : (
              <>Flags come from keyword rules for the 13 categories, checked line by line, in your browser.</>
            )}{" "}
            Suggestions follow FDA eligibility guidance (2020–2026), ICH E21 (draft), and ASCO–Friends
            recommendations. They are for protocol teams to review, not decisions.
          </p>
        </section>
      </LiquidGlassPanel>

      <LiquidGlassPanel className="enter-up p-5 sm:p-6" style={delay(200)}>
        <section aria-labelledby="results-title" aria-busy={pending}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-title" className="text-lg font-semibold text-ink">
              Results
            </h2>
            {run && run.flags.length > 0 ? (
              <GlassTabs idBase="lint-results" label="Linter results" tabs={tabs} value={tab} onChange={setTab} />
            ) : null}
          </div>

          {run?.notice ? (
            <p role="status" className="mt-3 rounded-xl bg-blush/60 px-3.5 py-2.5 text-sm text-ink ring-1 ring-rose/15">
              {run.notice}
            </p>
          ) : null}

          {run && flagCount > 0 && comparison.total > 0 ? (
            <div className="mt-4 rounded-2xl bg-ice/70 px-4 py-3 text-sm leading-relaxed text-ink ring-1 ring-cobalt/15">
              This draft restricts <span className="font-semibold">{flagCount} of 13</span> categories (
              {run.flags.filter((f) => f.absolute).length} outright). That&apos;s more than{" "}
              <span className="text-base font-semibold tabular-nums text-cobalt-deep">{comparison.pct}%</span> of{" "}
              {comparison.total.toLocaleString()} recruiting Massachusetts cancer trials (median: {comparison.median}),{" "}
              {run.engine === "model"
                ? "using the same model's reading of each trial's criteria."
                : "using the same keyword rules on each trial's criteria."}{" "}
              <span className="font-semibold">{fixFirst} to fix first.</span>
            </div>
          ) : null}

          {stale ? (
            <p className="mt-3 text-sm text-ink-soft">The criteria changed since this run. Run the linter again to update.</p>
          ) : null}

          {pending ? (
            <div className="glass-inset mt-4 grid min-h-64 place-items-center px-6 py-10 text-center lg:min-h-80">
              <div className="max-w-xs">
                <p className="font-semibold text-ink">{claudeName} is reading the criteria…</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  This usually takes a few seconds. Each restriction it finds is checked against your text.
                </p>
              </div>
            </div>
          ) : !run ? (
            <div className="glass-inset mt-4 grid min-h-64 place-items-center px-6 py-10 text-center lg:min-h-80">
              <div className="max-w-xs">
                <p className="font-semibold text-ink">No results yet</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  Run the linter to see flagged criteria and suggested alternatives.
                </p>
              </div>
            </div>
          ) : run.flags.length === 0 ? (
            <div className="glass-inset mt-4 grid min-h-64 place-items-center px-6 py-10 text-center lg:min-h-80">
              <div className="max-w-xs">
                <p className="font-semibold text-ink">No restrictive criteria found</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  None of the 13 categories (age, organ function, HIV, brain metastases, language and more) were
                  found. Review the text by hand too:{" "}
                  {run.engine === "model" ? "the model favors precision over recall." : "keyword rules can miss unusual wording."}
                </p>
              </div>
            </div>
          ) : tab === "flags" ? (
            <div {...tabPanelProps("lint-results", "flags")} className="mt-4 focus:outline-none">
              <div className="space-y-5">
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
                          const peers = peerCounts[flag.category] ?? 0;
                          const copiedThis = copyStatus?.category === flag.category ? copyStatus : null;
                          const note = tier === 3 ? TEAM_CALL_NOTES[flag.category] : undefined;
                          return (
                            <li key={`${flag.category}-${i}`} className="glass-inset p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <GlassBadge tone="cobalt">{categoryLabel(flag.category)}</GlassBadge>
                                <GlassBadge tone={flag.absolute ? "rose" : "neutral"}>
                                  {flag.absolute ? "Outright" : "Conditional"}
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
                              <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <p className="text-xs text-ink-faint">
                                  Source: {flag.suggestion_source || "no FDA or ASCO–Friends guidance covers this category"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFocus(flag.category);
                                    setTab("draft");
                                  }}
                                  className={`text-xs font-semibold text-cobalt hover:underline ${focusRing}`}
                                >
                                  Show in draft
                                </button>
                              </div>
                              {replacement ? (
                                <div className="mt-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-medium text-ink-faint">
                                      {peers > 0
                                        ? `${peers.toLocaleString()} Massachusetts ${peers === 1 ? "trial sets" : "trials set"} conditions here instead of a ban. Standard NCI wording:`
                                        : "Standard NCI wording:"}
                                    </p>
                                    <GlassButton
                                      variant="ghost"
                                      size="sm"
                                      aria-live="polite"
                                      onClick={() => copyReplacement(flag.category, replacement)}
                                    >
                                      {copiedThis ? (copiedThis.ok ? "Copied" : "Couldn't copy") : "Copy"}
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
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <GlassButton variant="secondary" size="sm" onClick={copyReport}>
                  Copy report
                </GlassButton>
                <span role="status" className="text-xs text-ink-faint">
                  {copied === "done" ? "Copied. Paste it into your protocol review." : copied === "failed" ? "Couldn't copy here; select the flags by hand." : ""}
                </span>
              </div>
            </div>
          ) : tab === "draft" ? (
            <div {...tabPanelProps("lint-results", "draft")} className="mt-4 focus:outline-none">
              <p className="text-xs text-ink-faint">
                Highlighted: each flagged sentence in the draft you ran (pink = excludes outright, blue = only under
                conditions).
              </p>
              <DraftHighlights text={lastRunText} flags={run.flags} />
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
                {run.flags.map((flag) => {
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

type Mark = { start: number; end: number; categories: string[]; absolute: boolean };

/** The draft as it was run, with each flagged sentence highlighted and labeled. */
function DraftHighlights({ text, flags }: { text: string; flags: LintFlag[] }) {
  const doc = normalizeCriteria(text);
  const spans: Mark[] = flags
    .flatMap((flag) => {
      // Keyword-rule quotes longer than 280 characters end in "..."; match the part before it.
      const span = locateQuote(doc, flag.source_text.replace(/\.\.\.$/, ""));
      return span ? [{ ...span, categories: [flag.category], absolute: flag.absolute }] : [];
    })
    .sort((a, b) => a.start - b.start);
  // Overlapping quotes (e.g. a whole-line quote over two sentences) become one mark.
  const marks: Mark[] = [];
  for (const span of spans) {
    const last = marks[marks.length - 1];
    if (last && span.start < last.end) {
      last.end = Math.max(last.end, span.end);
      last.categories.push(...span.categories);
      last.absolute ||= span.absolute;
    } else {
      marks.push(span);
    }
  }

  const parts: ReactNode[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.start > pos) parts.push(doc.slice(pos, m.start));
    parts.push(
      <mark
        key={m.start}
        data-categories={m.categories.join(" ")}
        className={`rounded-md px-0.5 text-ink ${m.absolute ? "bg-blush" : "bg-ice"}`}
      >
        {doc.slice(m.start, m.end)}
        <span className="ml-1 whitespace-nowrap rounded-full bg-white/80 px-1.5 align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-ink-soft ring-1 ring-line">
          {m.categories.map(categoryLabel).join(" · ")}
        </span>
      </mark>,
    );
    pos = m.end;
  }
  parts.push(doc.slice(pos));

  return (
    <div className="glass-inset mt-3 max-h-[36rem] overflow-auto whitespace-pre-wrap break-words p-4 text-sm leading-relaxed text-ink">
      {parts}
    </div>
  );
}
