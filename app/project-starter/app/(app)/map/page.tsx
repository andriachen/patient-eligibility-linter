import { CountyMapPanel } from "@/components/CountyMapPanel";
import { PageCard } from "@/components/PageCard";
import { loadCounties } from "@/lib/loadCounties";

export default function MapPage() {
  const data = loadCounties();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageCard>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-secondary)]">
          Map
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--brand-primary)]">
          County map
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Choropleth-style view of trial exclusions and community metrics by county.
        </p>

        <div className="mt-8">
          <CountyMapPanel counties={data.counties} dataSource={data.source} />
        </div>
      </PageCard>
    </main>
  );
}
