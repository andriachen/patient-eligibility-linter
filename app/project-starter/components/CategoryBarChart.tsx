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
      <h2 className="text-lg font-medium text-[var(--brand-primary)]">
        Trials excluding each category
      </h2>
      <ul className="mt-4 space-y-3">
        {sorted.map((row) => {
          const widthPct = maxPct > 0 ? (row.pctExcluded / maxPct) * 100 : 0;
          const highlighted = row.category === highlightCategory;

          return (
            <li key={row.category} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
              <span
                className={
                  highlighted
                    ? "font-semibold text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)]"
                }
              >
                {row.label}
              </span>
              <div className="h-3 rounded-full bg-[var(--border)]">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: highlighted
                      ? "var(--chart-bar-highlight)"
                      : "var(--chart-bar)",
                  }}
                  role="presentation"
                />
              </div>
              <span className="text-right tabular-nums text-[var(--text-muted)]">
                {row.pctExcluded}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
