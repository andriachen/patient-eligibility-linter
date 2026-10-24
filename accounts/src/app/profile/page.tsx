import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import type { SavedProfile } from "@/lib/wizard";

import { ProfileWizard } from "./wizard";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const loaded = await getProfile(user.id).then(
    (profile): { profile: SavedProfile | null; error?: string } => ({ profile }),
    (e: Error) => ({ profile: null, error: e.message }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
      {loaded.error ? (
        // Don't open a blank wizard over a profile we failed to read: saving would overwrite it.
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&apos;t load your profile: {loaded.error}. Refresh the page to try again.
        </p>
      ) : (
        <ProfileWizard initial={loaded.profile} />
      )}
    </div>
  );
}
