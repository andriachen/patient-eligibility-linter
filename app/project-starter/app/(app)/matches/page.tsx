import { MatchPanel } from "@/components/MatchPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export default function MatchesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        label="For patients"
        title="Find trials that fit you"
        description="A trial that could help you might be a few miles away, buried in fine print. We read it for you, rule out what clearly won't fit, and show you who to call nearby. Your next step: cross the threshold."
      />
      <MatchPanel />
    </div>
  );
}
