"use client";

import { useMemo, useState } from "react";

import { categoryLabel } from "@/lib/categories";
import type { ExclusionRow } from "@/lib/loadExclusionRows";

type Props = {
  rows: ExclusionRow[];
};

export function ExclusionTable({ rows }: Props) {
  const [category, setCategory] = useState("");
  const [phase, setPhase] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [textQuery, setTextQuery] = useState("");

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort(),
    [rows],
  );
  const phases = useMemo(
    () => [...new Set(rows.map((r) => r.phase))].sort(),
    [rows],
  );
  const sponsors = useMemo(
    () => [...new Set(rows.map((r) => r.sponsor))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (category && row.category !== category) return false;
      if (phase && row.phase !== phase) return false;
      if (sponsor && row.sponsor !== sponsor) return false;
      if (
        textQuery &&
        !row.source_text.toLowerCase().includes(textQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [rows, category, phase, sponsor, textQuery]);

  return (
    <section className="mt-10" aria-label="Exclusion criteria table">
      <h2 className="text-lg font-medium">Exclusion criteria in trials</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-neutral-600">
          Category
          <select
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Phase
          <select
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          >
            <option value="">All</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Sponsor
          <select
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            value={sponsor}
            onChange={(e) => setSponsor(e.target.value)}
          >
            <option value="">All</option>
            {sponsors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Search source text
          <input
            type="search"
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            placeholder="e.g. HbA1c"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Showing {filtered.length} of {rows.length} rows
      </p>

      <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Phase</th>
              <th className="px-3 py-2 font-medium">Sponsor</th>
              <th className="px-3 py-2 font-medium">Source text</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={`${row.category}-${i}`} className="border-t border-neutral-100">
                <td className="px-3 py-2 whitespace-nowrap">
                  {categoryLabel(row.category)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{row.phase}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.sponsor}</td>
                <td className="px-3 py-2 text-neutral-700">{row.source_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
