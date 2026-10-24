"use client";

import { useState, type CSSProperties } from "react";

import { controlTransition, focusRing } from "@/components/styles";
import { DemoDataBadge } from "@/components/ui/GlassBadge";
import { GlassField, GlassSelect } from "@/components/ui/GlassField";
import { GlassTabs, tabPanelProps, type GlassTab } from "@/components/ui/GlassTabs";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { CATEGORY_KEYS, categoryLabel } from "@/lib/categories";
import type { CountyRecord } from "@/lib/loadCounties";

type Props = {
  counties: CountyRecord[];
  dataSource: "mock" | "processed";
  defaultCategory?: string;
};

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

type MetricMode = "trial_pct" | "places" | "ej";

const MODES: GlassTab<MetricMode>[] = [
  { id: "trial_pct", label: "Exclusions" },
  { id: "places", label: "Health" },
  { id: "ej", label: "Environmental justice areas" },
];

const PLACES_LABELS: Record<string, string> = {
  diabetes: "Diabetes prevalence",
  obesity: "Obesity",
  smoking: "Smoking",
  mental_distress: "Mental distress",
  checkup: "Annual checkup",
};

/** MassGIS environmental-justice (EJ) block-group measures, rolled up to the county. */
const EJ_LABELS = {
  ej_minority_pct: "Minority residents",
  ej_limited_english_pct: "Limited-English households",
} as const;
type EjMeasure = keyof typeof EJ_LABELS;

/**
 * Five equal-interval classes of one petrol hue. Only lightness changes, so the order
 * still reads for colorblind viewers; ink text on the light three, white on the dark two.
 */
const CLASSES = [
  { bg: "#e6f0f0", dark: false },
  { bg: "#b9d5d8", dark: false },
  { bg: "#7dafb8", dark: false },
  { bg: "#3a7786", dark: true },
  { bg: "#1b4f5c", dark: true },
];

const classFor = (value: number, min: number, max: number) =>
  CLASSES[max > min ? Math.min(CLASSES.length - 1, Math.floor(((value - min) / (max - min)) * CLASSES.length)) : 0];

/** Counties left off the scale are hatched, so they never read as the lightest class. */
const NO_DATA_STYLE = {
  backgroundColor: "#ece9e3",
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0 5px, #d6d1c6 5px 6px)",
};

/**
 * Counties with fewer recruiting trials than this are too small for a fair percentage:
 * at 6 trials (Plymouth) one trial moves the number by 17 points.
 */
const MIN_TRIALS_FOR_PCT = 10;

const trialCount = (n: number) => (n === 0 ? "No trials" : `${n} trial${n === 1 ? "" : "s"}`);

/** Category label for mid-sentence use; keeps acronyms like HIV and BMI in capitals. */
const inSentence = (key: string) => {
  const label = categoryLabel(key);
  return label === label.toUpperCase() ? label : label.toLowerCase();
};

export function CountyMapPanel({ counties, dataSource, defaultCategory = "hiv" }: Props) {
  const [category, setCategory] = useState(
    CATEGORY_KEYS.includes(defaultCategory) ? defaultCategory : CATEGORY_KEYS[0],
  );
  const [placesMeasure, setPlacesMeasure] = useState("diabetes");
  const [ejMeasure, setEjMeasure] = useState<EjMeasure>("ej_minority_pct");
  const [metricMode, setMetricMode] = useState<MetricMode>("trial_pct");
  const [hovered, setHovered] = useState<CountyRecord | null>(null);

  /** null = no fair value for this county (fewer than MIN_TRIALS_FOR_PCT trials). */
  const valueFor = (c: CountyRecord): number | null => {
    if (metricMode === "trial_pct") {
      return c.trials < MIN_TRIALS_FOR_PCT ? null : (c.trialsWithCategoryPct[category] ?? 0);
    }
    if (metricMode === "places") {
      return c.places[placesMeasure as keyof typeof c.places] ?? 0;
    }
    return c.ej[ejMeasure];
  };

  const values = counties.map(valueFor);

  const scaled = values.filter((v): v is number => v !== null);
  const maxVal = scaled.length ? Math.max(...scaled) : 0;
  const minVal = scaled.length ? Math.min(...scaled) : 0;

  // Until someone picks a county, show the one with the most trials (Suffolk).
  const displayCounty =
    hovered ?? counties.reduce<CountyRecord | undefined>((best, c) => (!best || c.trials > best.trials ? c : best), undefined);
  const hoverValue = displayCounty ? valueFor(displayCounty) : null;

  const metricLabel =
    metricMode === "trial_pct"
      ? `Trials restricting ${inSentence(category)} (%)`
      : metricMode === "places"
        ? `PLACES: ${PLACES_LABELS[placesMeasure].toLowerCase()} (%)`
        : `Environmental justice areas: ${EJ_LABELS[ejMeasure].replace(/^\w/, (c) => c.toLowerCase())} (%)`;

  return (
    <div className="flex flex-col gap-6">
      <LiquidGlassPanel className="enter-up flex flex-col gap-5 p-5 sm:p-6" style={delay(140)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GlassTabs
            idBase="county-metric"
            label="Map metric"
            tabs={MODES}
            value={metricMode}
            onChange={setMetricMode}
          />
          {dataSource === "mock" ? <DemoDataBadge label="Mock data" /> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <GlassField label="Exclusion category">
            <GlassSelect
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setMetricMode("trial_pct");
              }}
            >
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {categoryLabel(key)}
                </option>
              ))}
            </GlassSelect>
          </GlassField>
          {metricMode === "places" ? (
            <GlassField label="CDC PLACES measure">
              <GlassSelect value={placesMeasure} onChange={(e) => setPlacesMeasure(e.target.value)}>
                {Object.entries(PLACES_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
          ) : null}
          {metricMode === "ej" ? (
            <GlassField label="Environmental justice measure">
              <GlassSelect value={ejMeasure} onChange={(e) => setEjMeasure(e.target.value as EjMeasure)}>
                {Object.entries(EJ_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
          ) : null}
        </div>
      </LiquidGlassPanel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <LiquidGlassPanel
          {...tabPanelProps("county-metric", metricMode)}
          className={`enter-up p-5 sm:p-6 ${focusRing}`}
          style={delay(200)}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Massachusetts counties</h2>
              <p className="mt-1 text-sm text-ink-soft">{metricLabel}</p>
            </div>
            <div className="w-full max-w-56">
              <p className="sr-only">
                Five equal-interval classes from {minVal}% (lightest) to {maxVal}% (darkest); hatched counties
                have too few trials.
              </p>
              <div className="flex gap-px" aria-hidden>
                {CLASSES.map((c) => (
                  <span key={c.bg} className="h-3 flex-1 first:rounded-l-[2px] last:rounded-r-[2px]" style={{ backgroundColor: c.bg }} />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-xs font-medium tabular-nums text-ink-soft">
                <span>{minVal}%</span>
                <span>{maxVal}%</span>
              </div>
            </div>
          </div>

          <div
            className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4"
            role="group"
            aria-label="Counties, colored by the selected metric"
          >
            {counties.map((c, idx) => {
              const value = values[idx];
              const cls = value === null ? null : classFor(value, minVal, maxVal);
              const dark = cls?.dark ?? false;
              const selected = displayCounty?.county_fips === c.county_fips;
              return (
                <button
                  key={c.county_fips}
                  type="button"
                  aria-pressed={selected}
                  className={`flex min-h-16 flex-col justify-between rounded-sm px-3 py-2.5 text-left ${focusRing} ${controlTransition} ${
                    selected
                      ? "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                      : `hover:ring-2 hover:ring-ink/40 ${cls ? "ring-1 ring-ink/10" : "border border-dashed border-line-strong"}`
                  } ${dark ? "text-white" : "text-ink"}`}
                  style={cls ? { backgroundColor: cls.bg } : NO_DATA_STYLE}
                  onMouseEnter={() => setHovered(c)}
                  onFocus={() => setHovered(c)}
                  onClick={() => setHovered(c)}
                >
                  <span className={`text-sm font-semibold ${value === null ? "text-ink-soft" : ""}`}>
                    {c.county}
                  </span>
                  <span
                    className={`text-xs tabular-nums ${
                      value === null ? "text-ink-soft" : dark ? "text-white/85" : "text-ink-soft"
                    }`}
                  >
                    {value === null ? trialCount(c.trials) : `${value}%`}
                  </span>
                </button>
              );
            })}
          </div>
          {metricMode === "trial_pct" && values.some((v) => v === null) ? (
            <p className="mt-3 text-xs text-ink-faint">
              Hatched counties have fewer than {MIN_TRIALS_FOR_PCT} recruiting trials, too few for a fair
              percentage.
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Trials: ClinicalTrials.gov (recruiting, MA sites). Health: CDC PLACES 2023, county crude
            prevalence. EJ: MassGIS 2020, environmental-justice block groups only. A trial counts in each
            county where it has a recruiting site; patients travel, so this is a simplification.
          </p>
        </LiquidGlassPanel>

        <LiquidGlassPanel
          className="enter-up self-start p-5 sm:p-6 lg:sticky lg:top-[calc(var(--header-offset)+0.5rem)]"
          style={delay(260)}
        >
          <aside aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              County detail
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-ink">
              {displayCounty?.county ?? "Select a county"}
            </h2>
            {displayCounty ? (
              <dl className="mt-4 divide-y divide-line text-sm">
                <DetailRow
                  label="Selected metric"
                  value={hoverValue === null ? "Too few trials" : `${hoverValue}%`}
                  strong
                />
                <DetailRow label="Trials recruiting here" value={displayCounty.trials} />
                <DetailRow label="Trial sites" value={displayCounty.trialSites} />
                <DetailRow
                  label={`Trials restricting ${inSentence(category)}`}
                  value={
                    displayCounty.trials === 0
                      ? "None"
                      : `${displayCounty.trialsWithCategoryPct[category]}% of ${displayCounty.trials}`
                  }
                />
                <DetailRow label="PLACES diabetes" value={`${displayCounty.places.diabetes}%`} />
                <DetailRow label="EJ minority residents" value={`${displayCounty.ej.ej_minority_pct}%`} />
                <DetailRow
                  label="EJ limited-English households"
                  value={`${displayCounty.ej.ej_limited_english_pct}%`}
                />
              </dl>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Hover, focus, or tap a county to see its numbers.
            </p>
          </aside>
        </LiquidGlassPanel>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-base font-semibold text-ink" : "font-medium text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
