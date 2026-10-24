import { CountyMapPanel } from "@/components/CountyMapPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadCounties } from "@/lib/loadCounties";
import { loadLandscapeStats } from "@/lib/loadStats";

export default function MapPage() {
  const data = loadCounties();
  const { defaultCategory } = loadLandscapeStats();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        label="Map"
        title="County map"
        description="Compare how often trials exclude a category with county health and environmental-justice data across Massachusetts."
      />
      <CountyMapPanel counties={data.counties} dataSource={data.source} defaultCategory={defaultCategory} />
    </div>
  );
}
