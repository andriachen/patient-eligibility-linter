import { CountyMapPanel } from "@/components/CountyMapPanel";
import { TurnedAwayPanel } from "@/components/TurnedAwayPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadCounties } from "@/lib/loadCounties";
import { loadLandscapeStats } from "@/lib/loadStats";
import { loadTurnedAwayData } from "@/lib/turnedAway";

export default function MapPage() {
  const data = loadCounties();
  const { defaultCategory } = loadLandscapeStats();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        label="Map"
        title="County map"
        description="Compare how often trials restrict a category with county health and environmental-justice data across Massachusetts."
      />
      <CountyMapPanel counties={data.counties} dataSource={data.source} defaultCategory={defaultCategory} />
      {/* Below the map, so pitch step 4 (pick language, hover Suffolk) still starts at the top. */}
      <TurnedAwayPanel data={loadTurnedAwayData()} />
    </div>
  );
}
