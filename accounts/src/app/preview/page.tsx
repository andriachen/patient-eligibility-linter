import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileWizard } from "../profile/wizard";

export const metadata: Metadata = { title: "Preview" };

/** Click through the questions without logging in. Only exists under `npm run dev`. */
export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm">
        Preview mode: you&apos;re not logged in, and nothing you answer is saved.
      </p>
      <ProfileWizard initial={null} preview />
    </div>
  );
}
