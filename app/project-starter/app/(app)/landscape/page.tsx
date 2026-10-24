import type { CSSProperties } from "react";

import { CategoryBarChart } from "@/components/CategoryBarChart";
import { ExclusionTable } from "@/components/ExclusionTable";
import { DemoDataBadge, GlassBadge } from "@/components/ui/GlassBadge";
import { LiquidGlassPanel } from "@/components/ui/LiquidGlassPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadExclusionRows } from "@/lib/loadExclusionRows";
import { getCategoryStat, loadLandscapeStats } from "@/lib/loadStats";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export default function LandscapePage() {
  const stats = loadLandscapeStats();
  const table = loadExclusionRows();
  const focus =
    getCategoryStat(stats, stats.defaultCategory) ?? stats.categories[0];
  const statsAreMock = stats.source === "mock";
  const pctPrefix = `${focus.pctExcluded}%`;
  const headlineRest = stats.headline?.startsWith(pctPrefix)
    ? stats.headline.slice(pctPrefix.length).trim()
    : stats.headline;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        label="Landscape"
        title="Who trial criteria leave out"
        description="How often each exclusion category appears in the eligibility criteria of recruiting Massachusetts cancer trials."
        aside={
          <GlassBadge tone="neutral">
            {stats.totalTrials} trials{statsAreMock ? " (mock)" : ""}
          </GlassBadge>
        }
      />

      <LiquidGlassPanel
        reflect
        className="enter-up grid items-center gap-x-8 gap-y-4 p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-7"
        style={delay(140)}
      >
        <h2 className="sr-only">Headline metric</h2>
        <p className="text-[clamp(4rem,3rem+4vw,6rem)] font-semibold leading-none tracking-[-0.045em] text-ink tabular-nums">
          {focus.pctExcluded}%
        </p>
        <div className="sm:border-l sm:border-line sm:pl-8">
          <p className="text-[clamp(1.25rem,1rem+0.8vw,1.625rem)] font-semibold leading-snug tracking-[-0.015em] text-ink">
            {headlineRest ?? (
              <>
                of trials exclude <span className="text-rose-deep">{focus.label.toLowerCase()}</span>
              </>
            )}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {focus.trialCount} of {stats.totalTrials} Massachusetts-linked trials
            {statsAreMock ? " in the mock dataset" : ""}.
          </p>
          {stats.headlineNote ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">{stats.headlineNote}</p>
          ) : null}
        </div>
        {statsAreMock ? (
          <div className="sm:self-start">
            <DemoDataBadge label="Mock data" />
          </div>
        ) : null}
      </LiquidGlassPanel>

      <LiquidGlassPanel className="enter-up p-6 sm:p-7" style={delay(200)}>
        <CategoryBarChart
          categories={stats.categories}
          totalTrials={stats.totalTrials}
          highlightCategory={focus.category}
          isMock={statsAreMock}
        />
      </LiquidGlassPanel>

      <LiquidGlassPanel className="enter-up p-5 sm:p-7" style={delay(260)}>
        <ExclusionTable rows={table.rows} isMock={table.source === "mock"} />
      </LiquidGlassPanel>
    </div>
  );
}
