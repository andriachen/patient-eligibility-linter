/** Interior pages: shared width, gutters, and room for the floating header. */
export default function InteriorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto w-full max-w-6xl px-[var(--page-gutter)] pb-20 pt-[calc(var(--header-offset)+0.5rem)]">
      {children}
    </main>
  );
}
