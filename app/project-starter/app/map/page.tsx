import { CountyMapPanel } from "@/components/CountyMapPanel";
import { loadCounties } from "@/lib/loadCounties";

export default function MapPage() {
  const data = loadCounties();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">County map</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Choropleth-style view of trial exclusions and community metrics by county.
      </p>

      <div className="mt-8">
        <CountyMapPanel counties={data.counties} dataSource={data.source} />
      </div>
    </main>
  );
}
