export function StatCard({
  label,
  value,
  hint,
  accent = "text-ink",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-canvas p-4 ring-1 ring-hairline transition-colors hover:bg-surface">
      <div className="text-xs text-steel">{label}</div>
      <div className={`mt-1 font-heading text-heading-3 ${accent}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone">{hint}</div>}
    </div>
  );
}
