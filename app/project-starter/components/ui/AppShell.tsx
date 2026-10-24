import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { AppHeader } from "@/components/ui/AppHeader";

/** Header and footer shared by every route. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip text-ink">
      <AppHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
