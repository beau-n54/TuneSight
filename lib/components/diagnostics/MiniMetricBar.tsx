type MiniMetricBarProps = {
  label: string;
  value: number;
  max?: number;
};

export function MiniMetricBar({
  label,
  value,
  max = 100,
}: MiniMetricBarProps) {
  const safeMax = max <= 0 ? 100 : max;
  const percentage = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}