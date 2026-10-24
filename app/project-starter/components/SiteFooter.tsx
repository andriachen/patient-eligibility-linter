import { StageShareLogo } from "@/components/StageShareLogo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
        <StageShareLogo compact />
        <p className="max-w-xl text-xs leading-relaxed text-[var(--text-muted)]">
          Public data: ClinicalTrials.gov, CDC PLACES, MassGIS. Suggestions are
          for protocol teams to review.
        </p>
      </div>
    </footer>
  );
}
