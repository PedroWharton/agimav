type Bar = { label: string; value: number };

export function HorizontalBarChart({
  bars,
  formatValue,
  maxBars = 10,
  barHeight = 22,
  gap = 6,
}: {
  bars: Bar[];
  formatValue?: (n: number) => string;
  maxBars?: number;
  barHeight?: number;
  gap?: number;
}) {
  const top = bars.slice(0, maxBars);
  const max = top.reduce((acc, b) => Math.max(acc, b.value), 0);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString("es-AR"));

  if (top.length === 0 || max <= 0) {
    return null;
  }

  return (
    <ul
      className="flex w-full flex-col"
      style={{ gap: `${gap}px` }}
      aria-label="Ranking"
    >
      {top.map((b) => {
        const pct = max > 0 ? (b.value / max) * 100 : 0;
        return (
          <li key={b.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{b.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmt(b.value)}
                </span>
              </div>
              <div
                className="w-full overflow-hidden rounded-sm bg-muted"
                style={{ height: `${barHeight / 3}px` }}
              >
                <div
                  className="h-full bg-sky-600"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
