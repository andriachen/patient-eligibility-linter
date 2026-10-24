"use client";

import { useMemo, useState } from "react";

import { CATEGORY_KEYS, categoryLabel } from "@/lib/categories";
import type { CountyRecord } from "@/lib/loadCounties";

type Props = {
  counties: CountyRecord[];
  dataSource: "mock" | "processed";
};

type MetricMode = "trial_pct" | "places" | "ej";

const PLACES_LABELS: Record<string, string> = {
  diabetes: "PLACES: diabetes prevalence",
  obesity: "PLACES: obesity",
  smoking: "PLACES: smoking",
  mental_distress: "PLACES: mental distress",
  checkup: "PLACES: annual checkup",
};

function colorForValue(value: number, max: number): string {
  if (max <= 0) return "rgb(229 231 235)";
  const t = Math.min(1, value / max);
  const r = Math.round(239 - t * 120);
  const g = Math.round(246 - t * 100);
  const b = Math.round(255 - t * 40);
  return `rgb(${r} ${g} ${b})`;
}

export function CountyMapPanel({ counties, dataSource }: Props) {
  const [category, setCategory] = useState("diabetes");
  const [placesMeasure, setPlacesMeasure] = useState("diabetes");
  const [metricMode, setMetricMode] = useState<MetricMode>("trial_pct");
  const [hovered, setHovered] = useState<CountyRecord | null>(null);

  const values = useMemo(() => {
    return counties.map((c) => {
      if (metricMode === "trial_pct") {
        return c.trialsWithCategoryPct[category] ?? 0;
      }
      if (metricMode === "places") {
        return c.places[placesMeasure as keyof typeof c.places] ?? 0;
      }
      return c.ej.ej_minority_pct;
    });
  }, [counties, category, metricMode, placesMeasure]);

  const maxVal = Math.max(...values, 1);

  const displayCounty = hovered ?? counties[0];

  const hoverValue = displayCounty
    ? metricMode === "trial_pct"
      ? (displayCounty.trialsWithCategoryPct[category] ?? 0)
      : metricMode === "places"
        ? displayCounty.places[placesMeasure as keyof typeof displayCounty.places]
        : displayCounty.ej.ej_minority_pct
    : 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600">
        Massachusetts counties — darker blue = higher value.{" "}
        {dataSource === "mock" ? "(mock data)" : ""}
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-medium text-neutral-600">
          Exclusion category (trial %)
          <select
            className="mt-1 block rounded-md border border-neutral-300 px-2 py-2 text-sm"
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
          </select>
        </label>

        <label className="text-xs font-medium text-neutral-600">
          Overlay metric
          <select
            className="mt-1 block rounded-md border border-neutral-300 px-2 py-2 text-sm"
            value={
              metricMode === "trial_pct"
                ? "trial_pct"
                : metricMode === "ej"
                  ? "ej"
                  : `places:${placesMeasure}`
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "trial_pct") setMetricMode("trial_pct");
              else if (v === "ej") setMetricMode("ej");
              else {
                setMetricMode("places");
                setPlacesMeasure(v.replace("places:", ""));
              }
            }}
          >
            <option value="trial_pct">Trials excluding category (%)</option>
            {Object.entries(PLACES_LABELS).map(([key, label]) => (
              <option key={key} value={`places:${key}`}>
                {label}
              </option>
            ))}
            <option value="ej">EJ: minority % (EJ areas)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
          role="img"
          aria-label="County choropleth grid"
        >
          {counties.map((c, idx) => {
            const value = values[idx];
            return (
              <button
                key={c.county_fips}
                type="button"
                className="rounded-md border border-neutral-200 px-2 py-3 text-left text-xs font-medium shadow-sm transition hover:ring-2 hover:ring-blue-400"
                style={{ backgroundColor: colorForValue(value, maxVal) }}
                onMouseEnter={() => setHovered(c)}
                onFocus={() => setHovered(c)}
              >
                {c.county}
              </button>
            );
          })}
        </div>

        <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <h2 className="font-semibold">
            {displayCounty?.county ?? "Hover a county"}
          </h2>
          {displayCounty ? (
            <ul className="mt-3 space-y-2 text-neutral-700">
              <li>
                <span className="text-neutral-500">Selected metric:</span>{" "}
                {hoverValue}%
              </li>
              <li>
                <span className="text-neutral-500">Trial sites:</span>{" "}
                {displayCounty.trialSites}
              </li>
              <li>
                <span className="text-neutral-500">
                  Trials excluding {categoryLabel(category)}:
                </span>{" "}
                {displayCounty.trialsWithCategoryPct[category]}%
              </li>
              <li>
                <span className="text-neutral-500">PLACES diabetes:</span>{" "}
                {displayCounty.places.diabetes}%
              </li>
              <li>
                <span className="text-neutral-500">EJ minority %:</span>{" "}
                {displayCounty.ej.ej_minority_pct}%
              </li>
            </ul>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
