export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-[var(--page-gutter)] pb-10">
      <div className="flex flex-col gap-3 border-t border-line pt-7 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
        <p className="max-w-xl leading-relaxed">
          Public data: ClinicalTrials.gov, CDC PLACES, MassGIS. Suggestions are for protocol
          teams to review.
        </p>
        <p>Threshold · Hackachusetts</p>
      </div>
    </footer>
  );
}
