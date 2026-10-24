import type { CategoryStat } from "@/lib/loadStats";

type Props = {
  categories: CategoryStat[];
  highlightCategory?: string;
};

export function CategoryBarChart({ categories, highlightCategory }: Props) {
  const sorted = [...categories].sort(
    (a, b) => b.pctExcluded - a.pctExcluded,
  );
  const maxPct = sorted[0]?.pctExcluded ?? 100;

  return (
    <section className="mt-10" aria-label="Exclusions by category">
      <h2 className="text-lg font-medium">Trials excluding each category</h2>
      <ul className="mt-4 space-y-3">
        {sorted.map((row) => {
          const widthPct = maxPct > 0 ? (row.pctExcluded / maxPct) * 100 : 0;
          const highlighted = row.category === highlightCategory;

          return (
            <li key={row.category} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
              <span className={highlighted ? "font-semibold" : "text-neutral-700"}>
                {row.label}
              </span>
              <div className="h-3 rounded bg-neutral-200">
                <div
                  className={`h-3 rounded ${highlighted ? "bg-blue-600" : "bg-blue-400"}`}
                  style={{ width: `${widthPct}%` }}
                  role="presentation"
                />
              </div>
              <span className="text-right tabular-nums text-neutral-600">
                {row.pctExcluded}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
