"use client";

import { useState } from "react";

import { categoryLabel } from "@/lib/categories";
import { mockLintCriteria, type LintFlag } from "@/lib/mockLint";

export function LinterPanel() {
  const [text, setText] = useState(
    "Participants with uncontrolled diabetes (HbA1c > 8%) or BMI over 35 are excluded. Must read and speak English.",
  );
  const [flags, setFlags] = useState<LintFlag[]>([]);
  const [countyImpact, setCountyImpact] = useState<
    { county: string; affectedTrialsPct: number }[]
  >([]);

  function runLint() {
    const result = mockLintCriteria(text);
    setFlags(result.flags);
    setCountyImpact(result.countyImpact);
  }

  return (
    <div className="space-y-8">
      <section>
        <label htmlFor="criteria" className="text-sm font-medium">
          Paste eligibility criteria
        </label>
        <textarea
          id="criteria"
          className="mt-2 min-h-40 w-full rounded-lg border border-neutral-300 p-3 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          onClick={runLint}
          className="mt-3 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--brand-primary-dark)]"
        >
          Run linter (mock)
        </button>
        <p className="mt-2 text-xs text-neutral-500">
          Real pipeline hook: <code className="text-xs">pipeline/extract/lint.py</code>{" "}
          — not wired yet.
        </p>
      </section>

      {flags.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium">Flags</h2>
          <ul className="mt-3 space-y-3">
            {flags.map((flag, i) => (
              <li
                key={`${flag.category}-${i}`}
                className="rounded-lg border border-neutral-200 p-4 text-sm"
              >
                <p className="font-semibold">{categoryLabel(flag.category)}</p>
                <p className="mt-1 text-neutral-600">{flag.source_text}</p>
                <p className="mt-2 text-neutral-800">
                  <span className="font-medium">Suggestion:</span> {flag.suggestion}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Source: {flag.suggestion_source}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {countyImpact.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium">County impact (mock)</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Share of local trials that might exclude people matching these flags.
          </p>
          <ul className="mt-3 space-y-2">
            {countyImpact.map((row) => (
              <li
                key={row.county}
                className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm"
              >
                <span>{row.county}</span>
                <span className="tabular-nums font-medium">
                  {row.affectedTrialsPct}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
