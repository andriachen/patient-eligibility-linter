import { CategoryBarChart } from "@/components/CategoryBarChart";
import { ExclusionTable } from "@/components/ExclusionTable";
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
      <h1 className="text-3xl font-semibold tracking-tight">
        {focus.pctExcluded}% of trials exclude {focus.label.toLowerCase()}
        {suffix}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Based on {stats.totalTrials} Massachusetts-linked trials
        {stats.source === "mock" ? " — mock data" : ""}.
      </p>

      <CategoryBarChart
        categories={stats.categories}
        highlightCategory={stats.defaultCategory}
      />

      <ExclusionTable rows={table.rows} />
      {table.source === "mock" ? (
        <p className="mt-2 text-xs text-neutral-500">Table uses mock rows.</p>
      ) : null}
    </main>
  );
}
