import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { HeartPulse, LogOut } from "lucide-react";

import { button } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { webHref } from "@/lib/web";

import { signOut } from "./login/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Threshold account", template: "%s · Threshold" },
  description: "Create a Threshold account and save your trial profile.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
            <a href={webHref()} className="flex items-center gap-2 font-semibold">
              <HeartPulse aria-hidden className="size-5 text-brand" />
              Threshold
            </a>
            {user ? (
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm text-muted">{user.email}</span>
                <form action={signOut}>
                  <button className={button.ghost}>
                    <LogOut aria-hidden className="size-4" />
                    Log out
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/login" className={button.secondary}>
                Log in
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">{children}</main>
        <footer className="px-4 pb-6 text-center text-xs text-muted">
          Public data: ClinicalTrials.gov, CDC PLACES, MassGIS. This isn&apos;t medical advice.
        </footer>
      </body>
    </html>
  );
}
