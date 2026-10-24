import { LinterPanel } from "@/components/LinterPanel";
import { PageCard } from "@/components/PageCard";

export default function LinterPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageCard>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-secondary)]">
          Linter
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--brand-primary)]">
          Criteria linter
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Paste protocol language to see exclusion flags and mock county impact.
        </p>

        <div className="mt-8">
          <LinterPanel />
        </div>
      </PageCard>
    </main>
  );
}
