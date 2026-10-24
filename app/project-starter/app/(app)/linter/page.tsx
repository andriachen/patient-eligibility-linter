import { LinterPanel } from "@/components/LinterPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadLintContext } from "@/lib/lintContext";

export default function LinterPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        label="Linter · For research teams"
        title="Criteria linter"
        description="Paste protocol language to flag restrictive exclusions and see alternatives to discuss with your protocol team."
      />
      <LinterPanel context={loadLintContext()} />
    </div>
  );
}
