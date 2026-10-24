"use client";

import { useState, useTransition, type CSSProperties } from "react";

import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassField, GlassInput, GlassSelect } from "@/components/ui/GlassField";
import { GlassTabs, tabPanelProps, type GlassTab } from "@/components/ui/GlassTabs";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { runMatch, type MatchCard, type MatchResponse } from "@/lib/matchAction";
import type { PatientVector } from "@/lib/matchTrials";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

// Questionnaire: one coarse question per category (docs/patient-matching.md §2).
type Opt = { value: string; label: string };
const Q: { key: keyof PatientVector; label: string; options: Opt[] }[] = [
  { key: "hiv", label: "HIV status", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "negative", label: "Negative" },
    { value: "positive_controlled", label: "Positive, controlled on treatment" },
    { value: "positive_uncontrolled", label: "Positive, not controlled" },
  ]},
  { key: "performance_status", label: "Day-to-day activity", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "fully_active", label: "Fully active" },
    { value: "restricted_but_mobile", label: "Restricted but up and about" },
    { value: "limited", label: "Limited / mostly resting" },
  ]},
  { key: "language", label: "English", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "english_ok", label: "I read & speak English comfortably" },
    { value: "english_limited", label: "Limited English" },
  ]},
  { key: "diabetes", label: "Diabetes", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "none", label: "No diabetes" },
    { value: "controlled", label: "Controlled" },
    { value: "uncontrolled", label: "Uncontrolled" },
  ]},
  { key: "renal", label: "Kidney function", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No known issue" },
    { value: "mild", label: "Mild reduction" },
    { value: "significant", label: "Significant / kidney disease" },
  ]},
  { key: "hepatic", label: "Liver function", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No known issue" },
    { value: "mild", label: "Mild / abnormal labs" },
    { value: "significant", label: "Significant / liver disease" },
  ]},
  { key: "cardiac", label: "Significant heart condition", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes (recent MI, heart failure, arrhythmia)" },
  ]},
  { key: "brain_mets", label: "Cancer spread to brain / CNS", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No" },
    { value: "treated_stable", label: "Yes, treated & stable" },
    { value: "active", label: "Yes, active" },
  ]},
  { key: "prior_malignancy", label: "A different cancer in the past few years", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
  ]},
  { key: "smoking", label: "Current tobacco / nicotine use", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
  ]},
  { key: "pregnancy", label: "Pregnant or breastfeeding", options: [
    { value: "unknown", label: "Prefer not to say" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
  ]},
];

const MA_COUNTIES = [
  "Barnstable", "Berkshire", "Bristol", "Dukes", "Essex", "Franklin", "Hampden",
  "Hampshire", "Middlesex", "Nantucket", "Norfolk", "Plymouth", "Suffolk", "Worcester",
];

type Tab = "worth" | "ask" | "notfit";

export function MatchPanel() {
  const [vec, setVec] = useState<Record<string, string>>({});
  const [cancerType, setCancerType] = useState("");
  const [age, setAge] = useState("");
  const [county, setCounty] = useState("");
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [tab, setTab] = useState<Tab>("worth");
  const [ageError, setAgeError] = useState("");
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    setVec((v) => ({ ...v, [key]: value }));
  }

  function search() {
    const patient: PatientVector = { ...(vec as PatientVector) };
    // #15: validate age is a plausible human age.
    if (age.trim()) {
      const n = Number(age);
      if (Number.isNaN(n) || n < 0 || n > 120) {
        setAgeError("Enter an age between 0 and 120.");
        return;
      }
      patient.age = n;
    }
    setAgeError("");
    if (county) patient.county = county;
    if (cancerType.trim()) patient.cancer_type = cancerType.trim();
    startTransition(async () => {
      const r = await runMatch(patient);
      setResult(r);
      setTab("worth");
    });
  }

  const tabs: GlassTab<Tab>[] = result
    ? [
        { id: "worth", label: `Worth reaching out (${result.counts.worth})` },
        { id: "ask", label: `Ask about one thing (${result.counts.ask})` },
        { id: "notfit", label: `Likely not yet (${result.counts.notFit})` },
      ]
    : [];

  const cards =
    result && (tab === "worth" ? result.worthReachingOut : tab === "ask" ? result.askAboutThis : result.likelyNotAFit);
  const totalForTab = result
    ? tab === "worth" ? result.counts.worth : tab === "ask" ? result.counts.ask : result.counts.notFit
    : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* Questionnaire */}
      <LiquidGlassPanel
        className="enter-up p-5 sm:p-6 lg:sticky lg:top-[calc(var(--header-offset)+0.5rem)]"
        style={delay(140)}
      >
        <h2 className="text-lg font-semibold text-ink">About you</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Answer what you&apos;re comfortable sharing. &quot;Prefer not to say&quot; is fine — we only
          use what you tell us.
        </p>

        <div className="mt-4 grid gap-3">
          <GlassField label="Cancer type" hint="e.g. breast, lung, lymphoma. We only show trials for your cancer.">
            <GlassInput
              placeholder="e.g. breast"
              value={cancerType}
              onChange={(e) => setCancerType(e.target.value)}
            />
          </GlassField>
          <div className="grid grid-cols-2 gap-3">
            <GlassField label="Age">
              <GlassInput
                inputMode="numeric"
                placeholder="e.g. 58"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value);
                  if (ageError) setAgeError("");
                }}
                aria-invalid={ageError ? true : undefined}
              />
            </GlassField>
            <GlassField label="Your county">
              <GlassSelect value={county} onChange={(e) => setCounty(e.target.value)}>
                <option value="">Anywhere in MA</option>
                {MA_COUNTIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </GlassSelect>
            </GlassField>
          </div>
          {ageError ? (
            <p role="alert" className="text-xs font-medium text-rose-deep">{ageError}</p>
          ) : null}

          {Q.map((q) => (
            <GlassField key={q.key as string} label={q.label}>
              <GlassSelect
                value={vec[q.key as string] ?? "unknown"}
                onChange={(e) => set(q.key as string, e.target.value)}
              >
                {q.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </GlassSelect>
            </GlassField>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <GlassButton onClick={search} disabled={pending}>
            {pending ? "Searching…" : "Find trials"}
          </GlassButton>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          We check 13 common eligibility barriers, not full eligibility. Results are a starting point,
          not medical advice — the study team confirms whether you can join.
        </p>
      </LiquidGlassPanel>

      {/* Results */}
      <LiquidGlassPanel className="enter-up p-5 sm:p-6" style={delay(200)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Trials near you</h2>
          {result ? (
            <GlassTabs idBase="match-results" label="Match buckets" tabs={tabs} value={tab} onChange={setTab} />
          ) : null}
        </div>

        {!result ? (
          <div className="glass-inset mt-4 grid min-h-80 place-items-center px-6 py-10 text-center">
            <div className="max-w-sm">
              <p className="font-semibold text-ink">Tell us about you, then search</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                We read the fine print of every recruiting Massachusetts cancer trial and rule out the
                ones that clearly won&apos;t fit — then show you who to call nearby.
              </p>
            </div>
          </div>
        ) : result.source === "mock" ? (
          <p className="glass-inset mt-4 grid min-h-40 place-items-center px-6 text-center text-sm text-ink-soft">
            Trial data isn&apos;t loaded. Try again shortly.
          </p>
        ) : (
          <div {...tabPanelProps("match-results", tab)} className="mt-4 focus:outline-none">
            {cards && cards.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-ink-faint">
                  {totalForTab > cards.length
                    ? `Showing ${cards.length} of ${totalForTab.toLocaleString()}`
                    : `${totalForTab.toLocaleString()} trial${totalForTab === 1 ? "" : "s"}`}
                  {" · we checked 13 common barriers, not full eligibility"}
                </p>
                <ul className="space-y-3">
                  {cards.map((c) => (
                    <MatchResultCard key={c.nct_id} card={c} bucket={tab} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="glass-inset grid min-h-40 place-items-center px-6 text-center text-sm text-ink-soft">
                No trials in this group for your answers.
              </p>
            )}
          </div>
        )}
      </LiquidGlassPanel>
    </div>
  );
}

function MatchResultCard({ card, bucket }: { card: MatchCard; bucket: Tab }) {
  return (
    <li className="glass-inset p-4">
      <div className="flex flex-wrap items-center gap-2">
        {card.nearby ? <GlassBadge tone="cobalt">Nearby</GlassBadge> : null}
        {card.notScreened ? <GlassBadge tone="neutral">Not screened</GlassBadge> : null}
        {card.phase ? <GlassBadge tone="neutral">{card.phase.replace(/;/g, ", ")}</GlassBadge> : null}
      </div>
      <p className="mt-2 font-semibold leading-snug text-ink">{card.title}</p>
      {card.site ? (
        <p className="mt-1 text-xs text-ink-faint">
          {card.site.facility} · {card.site.city}, {card.site.county} County · {card.lead_sponsor}
        </p>
      ) : (
        <p className="mt-1 text-xs text-ink-faint">{card.lead_sponsor}</p>
      )}

      {/* hits: the "one thing to ask" or the barrier */}
      {card.hits.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {card.hits.map((h, i) => (
            <li key={`${h.category}-${i}`}>
              <div className="flex items-center gap-2">
                <GlassBadge tone={h.severity === "hard" ? "rose" : "neutral"}>{h.label}</GlassBadge>
                {h.threshold ? <span className="text-xs text-ink-faint">{h.threshold}</span> : null}
              </div>
              <blockquote className="mt-1 border-l-2 border-periwinkle pl-3 text-xs leading-relaxed text-ink-soft">
                {h.source_text}
              </blockquote>
            </li>
          ))}
        </ul>
      ) : null}

      {/* #4: be honest when we couldn't extract this trial's criteria */}
      {card.notScreened ? (
        <p className="mt-2 text-xs text-ink-faint">
          We couldn&apos;t read this trial&apos;s criteria automatically — check the listing yourself.
        </p>
      ) : null}

      {/* CTA */}
      {bucket !== "notfit" ? (
        <a
          href={card.ctUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-cobalt hover:underline"
        >
          {bucket === "ask" ? "Ask the study team about this →" : "Contact the study team →"}
        </a>
      ) : (
        <a
          href={card.ctUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-xs text-ink-faint hover:underline"
        >
          View the trial listing →
        </a>
      )}
    </li>
  );
}
