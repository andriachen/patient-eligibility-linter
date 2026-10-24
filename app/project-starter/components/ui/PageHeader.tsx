import type { CSSProperties, ReactNode } from "react";

import { eyebrow } from "@/components/styles";

type Props = {
  label: string;
  title: ReactNode;
  description: ReactNode;
  /** Badges or actions shown beside the description. */
  aside?: ReactNode;
};

/** Shared heading block for interior pages. */
export function PageHeader({ label, title, description, aside }: Props) {
  return (
    <header className="enter-up flex flex-col gap-5 md:flex-row md:items-end md:justify-between" style={{ "--delay": "80ms" } as CSSProperties}>
      <div className="max-w-2xl">
        <p className={eyebrow}>{label}</p>
        <h1 className="mt-3 text-title font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-lead text-ink-soft">{description}</p>
      </div>
      {aside ? <div className="flex flex-wrap gap-2 md:justify-end">{aside}</div> : null}
    </header>
  );
}
