import { CategoryBarChart } from "@/components/CategoryBarChart";
import { ExclusionTable } from "@/components/ExclusionTable";
import { PageCard } from "@/components/PageCard";
import { loadExclusionRows } from "@/lib/loadExclusionRows";
import { getCategoryStat, loadLandscapeStats } from "@/lib/loadStats";

export default function LandscapePage() {
  const stats = loadLandscapeStats();
  const table = loadExclusionRows();
  const focus =
    getCategoryStat(stats, stats.defaultCategory) ?? stats.categories[0];

  const suffix = stats.source === "mock" ? " (mock)" : "";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageCard>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-secondary)]">
          Landscape
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--brand-primary)]">
          {stats.headline ? (
            stats.headline
          ) : (
            <>
              <span className="text-[var(--brand-accent)]">{focus.pctExcluded}%</span> of
              trials exclude {focus.label.toLowerCase()}
            </>
          )}
          {suffix}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Based on {stats.totalTrials} Massachusetts-linked trials
          {stats.source === "mock" ? " — mock data" : ""}.
        </p>
        {stats.headlineNote ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{stats.headlineNote}</p>
        ) : null}

        <CategoryBarChart
          categories={stats.categories}
          highlightCategory={stats.defaultCategory}
        />

        <ExclusionTable rows={table.rows} />
        {table.source === "mock" ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Table uses mock rows.</p>
        ) : null}
      </PageCard>
    </main>
  );
}
