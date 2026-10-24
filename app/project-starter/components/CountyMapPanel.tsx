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

/** Light ice → cobalt → deep navy-blue. */
const SCALE: [number, number, number][] = [
  [214, 225, 255], // light, but clearly blue next to the grey no-data tiles
  [159, 180, 248],
  [53, 101, 245],
  [35, 55, 158],
];

/** Position of value between the lowest and highest county, mapped onto SCALE. */
function colorForValue(value: number, min: number, max: number): [number, number, number] {
  const t = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const scaled = t * (SCALE.length - 1);
  const i = Math.min(SCALE.length - 2, Math.floor(scaled));
  const f = scaled - i;
  return [0, 1, 2].map((c) => Math.round(SCALE[i][c] + (SCALE[i + 1][c] - SCALE[i][c]) * f)) as [
    number,
    number,
    number,
  ];
}

function isDark([r, g, b]: [number, number, number]) {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.28;
}

const rgb = (c: [number, number, number]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

/**
 * Counties with fewer recruiting trials than this are too small for a fair percentage:
 * at 6 trials (Plymouth) one trial moves the number by 17 points.
 */
const MIN_TRIALS_FOR_PCT = 10;

/** Tile color for counties left off the scale (too few trials for a percentage). */
const NO_DATA: [number, number, number] = [236, 238, 243];

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
                Color scale from {minVal}% (lightest) to {maxVal}% (darkest).
              </p>
              <div
                className="h-2.5 rounded-full shadow-[inset_0_0_0_1px_rgb(23_36_71/0.08)]"
                style={{
                  background: `linear-gradient(90deg, ${SCALE.map((c) => rgb(c)).join(", ")})`,
                }}
              />
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
              const color = value === null ? NO_DATA : colorForValue(value, minVal, maxVal);
              const dark = isDark(color);
              const selected = displayCounty?.county_fips === c.county_fips;
              return (
                <button
                  key={c.county_fips}
                  type="button"
                  aria-pressed={selected}
                  className={`flex min-h-16 flex-col justify-between rounded-xl px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_6px_16px_-12px_rgb(23_36_71/0.5)] ${focusRing} ${controlTransition} ${
                    selected ? "ring-2 ring-rose ring-offset-2 ring-offset-white/60" : "ring-1 ring-ink/[0.06] hover:ring-2 hover:ring-cobalt/50"
                  } ${dark ? "text-white" : "text-ink"}`}
                  style={{ backgroundColor: rgb(color) }}
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
              Grey counties have fewer than {MIN_TRIALS_FOR_PCT} recruiting trials, too few for a fair
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
