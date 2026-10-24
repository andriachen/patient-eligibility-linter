import type { CategoryStat } from "@/lib/loadStats";

import { DemoDataBadge } from "@/components/ui/GlassBadge";
import { focusRing } from "@/components/styles";

type Props = {
  categories: CategoryStat[];
  totalTrials: number;
  highlightCategory?: string;
  isMock?: boolean;
};

export function CategoryBarChart({ categories, totalTrials, highlightCategory, isMock }: Props) {
  const sorted = [...categories].sort((a, b) => b.pctExcluded - a.pctExcluded);
  const maxPct = sorted[0]?.pctExcluded ?? 100;

  return (
    <section aria-labelledby="category-chart-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="category-chart-title" className="text-lg font-semibold text-ink">
            Trials excluding each category
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Share of {totalTrials} trials. Bars are scaled to the largest category.
          </p>
        </div>
        {isMock ? <DemoDataBadge label="Mock data" /> : null}
      </div>

      <ul className="mt-6 space-y-2.5">
        {sorted.map((row) => {
          const widthPct = maxPct > 0 ? (row.pctExcluded / maxPct) * 100 : 0;
          const highlighted = row.category === highlightCategory;
          const detail = `${row.label}: ${row.pctExcluded}% of trials (${row.trialCount} of ${totalTrials})`;

          return (
            <li key={row.category}>
              <div
                tabIndex={0}
                aria-label={detail}
                className={`group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg py-0.5 text-sm sm:grid-cols-[minmax(6.5rem,9.5rem)_minmax(0,1fr)_2.75rem] ${focusRing}`}
              >
                <span
                  className={`col-start-1 row-start-1 truncate ${highlighted ? "font-semibold text-ink" : "font-medium text-ink"}`}
                >
                  {row.label}
                </span>
                <div
                  className="col-span-2 row-start-2 h-3 overflow-hidden rounded-[2px] bg-sunken sm:col-span-1 sm:col-start-2 sm:row-start-1"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: `${widthPct}%`,
                      background: highlighted ? "var(--chart-bar-highlight)" : "var(--chart-bar)",
                    }}
                  />
                </div>
                <span
                  className={`col-start-2 row-start-1 text-right tabular-nums sm:col-start-3 ${highlighted ? "font-semibold text-accent" : "text-ink-soft"}`}
                  aria-hidden
                >
                  {row.pctExcluded}%
                </span>

                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-full left-[9.5rem] z-20 mb-1.5 hidden whitespace-nowrap rounded-control border border-line bg-surface shadow-sm px-3 py-1.5 text-xs font-medium text-ink group-hover:block group-focus-visible:block max-sm:left-0"
                >
                  {row.trialCount} of {totalTrials} trials
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
