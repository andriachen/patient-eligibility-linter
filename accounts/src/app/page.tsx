import Link from "next/link";
import { FlaskConical, HandHeart, UserRound } from "lucide-react";

import { button, card } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";

const AUDIENCES = [
  { icon: UserRound, title: "Patients", text: "Share your health basics once, ready for trial matching when it launches." },
  { icon: HandHeart, title: "Caregivers", text: "Answer for the person you're helping, and keep it saved for later." },
  { icon: FlaskConical, title: "Trial teams", text: "Tell us what you run, so we can show who your criteria leave out." },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-8">
      <section className={card}>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Save your trial profile</h1>
        <p className="mt-3 max-w-xl text-muted">
          Answer a few questions, one at a time, and keep them in your account for future trial matching. It
          takes about 2 minutes, and you can stop and pick up where you left off.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <Link href="/profile" className={button.primary}>
              Go to your profile
            </Link>
          ) : (
            <>
              <Link href="/login?mode=signup" className={button.primary}>
                Create an account
              </Link>
              <Link href="/login" className={button.secondary}>
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {AUDIENCES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-2xl border border-border bg-card p-5">
            <Icon aria-hidden className="size-5 text-brand" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
