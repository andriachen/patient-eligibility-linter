import { LinterPanel } from "@/components/LinterPanel";

export default function LinterPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Criteria linter</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Paste protocol language to see exclusion flags and mock county impact.
      </p>

      <div className="mt-8">
        <LinterPanel />
      </div>
    </main>
  );
}
