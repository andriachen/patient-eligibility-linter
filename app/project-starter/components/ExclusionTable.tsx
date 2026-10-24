"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { focusRing } from "@/components/styles";
import { DemoDataBadge, GlassBadge } from "@/components/ui/GlassBadge";
import { GlassField, GlassInput, GlassSelect } from "@/components/ui/GlassField";
import { categoryLabel } from "@/lib/categories";
import type { ExclusionRow } from "@/lib/loadExclusionRows";

type Props = {
  rows: ExclusionRow[];
  isMock?: boolean;
};

export function ExclusionTable({ rows, isMock }: Props) {
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
      const q = textQuery.toLowerCase();
      if (q && !row.source_text.toLowerCase().includes(q) && !row.nct_id?.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, category, phase, sponsor, textQuery]);

  return (
    <section aria-labelledby="exclusion-table-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="exclusion-table-title" className="text-lg font-semibold text-ink">
            Exclusion criteria in trials
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Quoted criteria text, filterable by category, phase and sponsor.
          </p>
        </div>
        {isMock ? <DemoDataBadge label="Mock rows" /> : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GlassField label="Category">
          <GlassSelect value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </GlassSelect>
        </GlassField>
        <GlassField label="Phase">
          <GlassSelect value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">All</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </GlassSelect>
        </GlassField>
        <GlassField label="Sponsor">
          <GlassSelect value={sponsor} onChange={(e) => setSponsor(e.target.value)}>
            <option value="">All</option>
            {sponsors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </GlassSelect>
        </GlassField>
        <GlassField label="Search text or NCT ID">
          <GlassInput
            type="search"
            placeholder="e.g. HbA1c"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
          />
        </GlassField>
      </div>

      <p className="mt-4 text-sm text-ink-soft" aria-live="polite">
        Showing <span className="font-semibold text-ink tabular-nums">{filtered.length}</span> of{" "}
        <span className="tabular-nums">{rows.length}</span> rows
      </p>

      <div className="glass-inset mt-3 max-h-[36rem] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-sunken text-xs uppercase tracking-[0.08em] text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Trial</th>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Phase</th>
              <th scope="col" className="px-4 py-3 font-semibold">Sponsor</th>
              <th scope="col" className="px-4 py-3 font-semibold">Source text</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={`${row.category}-${i}`} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-3">
                  {row.nct_id ? (
                    <Link
                      href={`/trial/${row.nct_id}`}
                      prefetch={false}
                      className={`font-mono text-xs text-accent underline-offset-2 hover:underline ${focusRing}`}
                    >
                      {row.nct_id}
                    </Link>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <GlassBadge tone="cobalt">{categoryLabel(row.category)}</GlassBadge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{row.phase}</td>
                <td className="min-w-[9rem] max-w-[14rem] px-4 py-3 leading-snug text-ink-soft">{row.sponsor}</td>
                <td className="min-w-[18rem] px-4 py-3 leading-relaxed text-ink">{row.source_text}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                  No rows match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
