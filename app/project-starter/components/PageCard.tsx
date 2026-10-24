type Props = {
  children: React.ReactNode;
  className?: string;
};

export function PageCard({ children, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
