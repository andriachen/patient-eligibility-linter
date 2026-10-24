"use client";

import { useId, useState, type CSSProperties } from "react";

import { DemoDataBadge, GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassTextarea } from "@/components/ui/GlassField";
import { GlassTabs, tabPanelProps, type GlassTab } from "@/components/ui/GlassTabs";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { categoryLabel } from "@/lib/categories";
import { mockLintCriteria, type LintResult } from "@/lib/mockLint";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

type ResultTab = "flags" | "impact";

const SAMPLE =
  "Participants with uncontrolled diabetes (HbA1c > 8%) or BMI over 35 are excluded. Must read and speak English.";

export function LinterPanel() {
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
  const tabs: GlassTab<ResultTab>[] = [
    { id: "flags", label: `Flags${result ? ` (${result.flags.length})` : ""}` },
    { id: "impact", label: "County impact" },
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
            <DemoDataBadge label="Mock linter" />
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
            <GlassButton onClick={runLint}>Run linter (mock)</GlassButton>
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
            Real pipeline hook: <code className="font-mono text-[0.7rem]">pipeline/extract/lint.py</code>{" "}
            — not wired yet. Suggestions are for protocol teams to review.
          </p>
        </section>
      </LiquidGlassPanel>

      <LiquidGlassPanel className="enter-up p-5 sm:p-6" style={delay(200)}>
        <section aria-labelledby="results-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-title" className="text-lg font-semibold text-ink">
              Results
            </h2>
            {result ? (
              <GlassTabs
                idBase="lint-results"
                label="Linter results"
                tabs={tabs}
                value={tab}
                onChange={setTab}
              />
            ) : null}
          </div>

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
          ) : tab === "flags" ? (
            <ul {...tabPanelProps("lint-results", "flags")} className="mt-4 space-y-3 focus:outline-none">
              {result.flags.map((flag, i) => (
                <li key={`${flag.category}-${i}`} className="glass-inset p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <GlassBadge tone="cobalt">{categoryLabel(flag.category)}</GlassBadge>
                    <GlassBadge tone={flag.absolute ? "rose" : "neutral"}>
                      {flag.absolute ? "Absolute" : "Conditional"}
                    </GlassBadge>
                    <span className="text-xs font-medium capitalize text-ink-faint">{flag.section}</span>
                  </div>
                  <blockquote className="mt-3 border-l-2 border-periwinkle pl-3 text-sm leading-relaxed text-ink-soft">
                    {flag.source_text}
                  </blockquote>
                  <p className="mt-3 text-sm leading-relaxed text-ink">
                    <span className="font-semibold">Suggestion:</span> {flag.suggestion}
                  </p>
                  <p className="mt-1.5 text-xs text-ink-faint">Source: {flag.suggestion_source}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div {...tabPanelProps("lint-results", "impact")} className="mt-4 focus:outline-none">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  Share of local trials that might exclude people matching these flags.
                </p>
                <DemoDataBadge label="Mock" />
              </div>
              <ul className="glass-inset mt-3 divide-y divide-line">
                {result.countyImpact.map((row) => (
                  <li key={row.county} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="font-medium text-ink">{row.county}</span>
                    <span className="font-semibold tabular-nums text-ink">{row.affectedTrialsPct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </LiquidGlassPanel>
    </div>
  );
}
