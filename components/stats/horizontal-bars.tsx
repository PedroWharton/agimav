import { cn } from "@/lib/utils";

export type HorizontalBarTone =
  | "ok"
  | "warn"
  | "danger"
  | "info"
  | "neutral"
  | "brand";

export type HorizontalBarRow = {
  label: string;
  value: number;
  tone?: HorizontalBarTone;
  /** Optional objective line, e.g. 90 for OTIF target; rendered as vertical dashed line. */
  objective?: number;
  /** Optional secondary value shown on the right (e.g. "148 / 168h"). */
  secondary?: string;
};

function toneToFill(tone: HorizontalBarTone | undefined): string {
  switch (tone) {
    case "ok":
      return "var(--success)";
    case "warn":
      return "var(--warn)";
    case "danger":
      return "var(--danger)";
    case "info":
      return "var(--info)";
    case "brand":
      return "var(--brand)";
    case "neutral":
    default:
      return "var(--muted-foreground)";
  }
}

/**
 * Horizontal labeled bars. Row label left, bar fill middle, numeric label right.
 * Optional dashed objective line per row (e.g. 90% target). No external deps.
 *
 * Layout compromise: label column is a fixed fraction (35%) of the viewport.
 * For very long labels, truncate at call site — we don't insert ellipsis inside
 * SVG (text overflow handling inside <text> is painful across browsers).
 */
export function HorizontalBars({
  data,
  maxValue,
  formatValue,
  showValueLabels = true,
  variant = "default",
  ariaLabel,
  className,
}: {
  data: HorizontalBarRow[];
  maxValue?: number;
  formatValue?: (n: number) => string;
  showValueLabels?: boolean;
  variant?: "default" | "mini";
  ariaLabel?: string;
  className?: string;
}) {
  const fmt = formatValue ?? ((n: number) => n.toLocaleString("es-AR"));
  const isMini = variant === "mini";
  const showLabels = showValueLabels && !isMini;

  const computedMax = data.reduce(
    (acc, r) => Math.max(acc, r.value, r.objective ?? 0),
    0,
  );
  const max = maxValue ?? computedMax;
  const safeMax = max > 0 ? max : 1;

  const rowH = isMini ? 18 : 28;
  const pT = isMini ? 4 : 8;
  const pB = 8;
  const pL = isMini ? 92 : 168;
  const pR = showLabels ? 56 : 16;
  const w = 540;
  const h = pT + data.length * rowH + pB;
  const bw = Math.max(1, w - pL - pR);
  const barH = isMini ? rowH - 8 : rowH - 14;

  if (data.length === 0) {
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

  const summary = data
    .map((r) => `${r.label} ${fmt(r.value)}`)
    .join(", ");

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Barras horizontales"}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={h}
      className={cn("block", className)}
    >
      <desc>{summary}</desc>
      {data.map((row, i) => {
        const y = pT + i * rowH;
        const fill = toneToFill(row.tone);
        const filledW = (Math.max(0, row.value) / safeMax) * bw;
        return (
          <g key={`${row.label}-${i}`}>
            <text
              x={pL - 8}
              y={y + rowH / 2 + 3}
              textAnchor="end"
              className="fill-foreground"
              style={{ fontSize: isMini ? 10.5 : 11.5 }}
            >
              {row.label}
            </text>
            <rect
              x={pL}
              y={y + (rowH - barH) / 2}
              width={bw}
              height={barH}
              rx={2}
              fill="var(--muted)"
            />
            <rect
              x={pL}
              y={y + (rowH - barH) / 2}
              width={filledW}
              height={barH}
              rx={2}
              fill={fill}
            >
              <title>{`${row.label}: ${fmt(row.value)}`}</title>
            </rect>
            {typeof row.objective === "number" ? (
              <line
                x1={pL + (row.objective / safeMax) * bw}
                x2={pL + (row.objective / safeMax) * bw}
                y1={y + 2}
                y2={y + rowH - 2}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            ) : null}
            {showLabels ? (
              <text
                x={pL + filledW + 6}
                y={y + rowH / 2 + 3}
                className="fill-foreground font-mono"
                style={{ fontSize: 10.5, fontWeight: 600 }}
              >
                {row.secondary ?? fmt(row.value)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
