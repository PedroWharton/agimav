import { cn } from "@/lib/utils";

export type HeatmapCell = { row: string; col: string; value: number };

/**
 * Default color scale: ramps through token-backed `color-mix()` from `var(--muted)`
 * (0) to `var(--danger)` (max). Because color-mix resolves at render time and the
 * tokens have `.dark` overrides, this works in both themes without hardcoded hex.
 *
 * If `max <= 0`, everything is the baseline muted color.
 */
function defaultColorScale(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "var(--muted)";
  const t = Math.max(0, Math.min(1, value / max));
  const pct = Math.round(t * 100);
  // Blend danger into card so low values read as almost-neutral and high
  // values as saturated danger. Using `--card` (not `--muted`) as the base
  // keeps the low end light in both themes.
  return `color-mix(in oklch, var(--danger) ${pct}%, var(--card))`;
}

/**
 * Geometry compromise: the row-label column is fixed at 80px and cell width
 * derives from available space — callers with >16 columns should shrink the
 * container or pass a wider `cellSize`. We don't try to overflow-scroll inside
 * the SVG; wrap in a scrollable container if your column count is huge.
 */
export function Heatmap({
  rows,
  cols,
  data,
  colorScale,
  formatValue,
  cellSize = 28,
  labelCol = 80,
  ariaLabel,
  className,
}: {
  rows: string[];
  cols: string[];
  data: HeatmapCell[];
  colorScale?: (value: number, max: number) => string;
  formatValue?: (n: number) => string;
  /** Per-cell side in px (square). Default 28. */
  cellSize?: number;
  /** Row-label column width in px. Default 80. */
  labelCol?: number;
  ariaLabel?: string;
  className?: string;
}) {
  const scale = colorScale ?? defaultColorScale;
  const fmt = formatValue ?? ((n: number) => (n > 0 ? String(n) : ""));

  // Index data by "row|col".
  const cellValues = new Map<string, number>();
  for (const cell of data) {
    cellValues.set(`${cell.row}|${cell.col}`, cell.value);
  }

  const max = data.reduce((acc, c) => Math.max(acc, c.value), 0);

  const headerH = 22;
  const gap = 2;
  const w = labelCol + cols.length * (cellSize + gap);
  const h = headerH + rows.length * (cellSize + gap);

  if (rows.length === 0 || cols.length === 0) {
    return (
      <div
        className={cn("text-xs text-muted-foreground", className)}
        role="img"
        aria-label="Sin datos"
      >
        —
      </div>
    );
  }

  const summary = `Heatmap ${rows.length}×${cols.length}, máx ${max}.`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Mapa de calor"}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={h}
      className={cn("block", className)}
    >
      <desc>{summary}</desc>

      {cols.map((col, ci) => {
        const cx = labelCol + ci * (cellSize + gap) + cellSize / 2;
        return (
          <text
            key={`col-${col}-${ci}`}
            x={cx}
            y={headerH - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10.5 }}
          >
            {col}
          </text>
        );
      })}

      {rows.map((row, ri) => {
        const cy = headerH + ri * (cellSize + gap) + cellSize / 2;
        return (
          <text
            key={`row-${row}-${ri}`}
            x={labelCol - 8}
            y={cy + 3}
            textAnchor="end"
            className="fill-foreground"
            style={{ fontSize: 11 }}
          >
            {row}
          </text>
        );
      })}

      {rows.map((row, ri) =>
        cols.map((col, ci) => {
          const value = cellValues.get(`${row}|${col}`) ?? 0;
          const x = labelCol + ci * (cellSize + gap);
          const y = headerH + ri * (cellSize + gap);
          const fill = scale(value, max);
          const label = fmt(value);
          // Light cells → dark text; dark cells → light. Threshold at 55%
          // because the scale is relatively linear against --card → --danger.
          const textClass =
            max > 0 && value / max >= 0.55
              ? "fill-[var(--card)]"
              : "fill-foreground";
          return (
            <g key={`cell-${row}-${col}-${ri}-${ci}`}>
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={3}
                fill={fill}
              >
                <title>{`${row} · ${col}: ${value}`}</title>
              </rect>
              {label ? (
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize / 2 + 3}
                  textAnchor="middle"
                  className={cn("font-mono", textClass)}
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        }),
      )}
    </svg>
  );
}
