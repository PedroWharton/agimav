import { cn } from "@/lib/utils";

export type StackedBarSegment = {
  key: string;
  value: number;
  /** Explicit color (CSS var string or token). Overrides the palette. */
  color?: string;
};

export type StackedBarGroup = {
  /** X-axis label (period, e.g. "Ene", "Feb"). */
  label: string;
  segments: StackedBarSegment[];
};

/** Stable palette keyed by segment order (brand → info → success → warn → danger → neutral). */
const PALETTE: string[] = [
  "var(--brand)",
  "var(--info)",
  "var(--success)",
  "var(--warn)",
  "var(--danger)",
  "var(--muted-foreground)",
];

function paletteFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

/**
 * Vertical stacked bars. One bar per group (period), segments stacked by `key`.
 * Colors derive from the segment's explicit `color`, then from `segmentOrder`
 * index in the stable palette, else by first-seen order.
 *
 * Legend is caller's responsibility.
 */
export function StackedBars({
  data,
  segmentOrder,
  formatValue,
  ariaLabel,
  className,
}: {
  data: StackedBarGroup[];
  segmentOrder?: string[];
  formatValue?: (n: number) => string;
  ariaLabel?: string;
  className?: string;
}) {
  const fmt = formatValue ?? ((n: number) => n.toLocaleString("es-AR"));

  // Derive segment order: explicit > first-seen across groups.
  const resolvedOrder = (() => {
    if (segmentOrder && segmentOrder.length > 0) return segmentOrder;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const g of data) {
      for (const s of g.segments) {
        if (!seen.has(s.key)) {
          seen.add(s.key);
          out.push(s.key);
        }
      }
    }
    return out;
  })();

  const colorByKey = new Map<string, string>();
  resolvedOrder.forEach((key, idx) => {
    colorByKey.set(key, paletteFor(idx));
  });
  for (const g of data) {
    for (const s of g.segments) {
      if (s.color) colorByKey.set(s.key, s.color);
    }
  }

  const groupTotals = data.map((g) =>
    g.segments.reduce((acc, s) => acc + Math.max(0, s.value), 0),
  );
  const maxTotal = groupTotals.reduce((acc, t) => Math.max(acc, t), 0);
  const safeMax = maxTotal > 0 ? maxTotal : 1;

  const w = 540;
  const h = 220;
  const pL = 48;
  const pR = 16;
  const pT = 12;
  const pB = 28;
  const innerH = h - pT - pB;
  const innerW = w - pL - pR;

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

  const slot = innerW / data.length;
  const bw = Math.min(36, slot * 0.6);

  // Four gridlines (0, 1/3, 2/3, max).
  const ticks = [0, safeMax / 3, (safeMax / 3) * 2, safeMax];

  const summary = data
    .map((g, i) => `${g.label}: ${fmt(groupTotals[i] ?? 0)}`)
    .join(", ");

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Barras apiladas"}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={h}
      className={cn("block", className)}
    >
      <desc>{summary}</desc>

      {ticks.map((v, i) => {
        const y = pT + innerH - (v / safeMax) * innerH;
        return (
          <g key={`tick-${i}`}>
            <line
              x1={pL}
              x2={w - pR}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.55}
            />
            <text
              x={pL - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {fmt(Math.round(v))}
            </text>
          </g>
        );
      })}

      {data.map((group, gi) => {
        const cx = pL + slot * gi + slot / 2;
        const x = cx - bw / 2;
        let cursor = 0;
        return (
          <g key={`${group.label}-${gi}`}>
            {group.segments.map((seg, si) => {
              const value = Math.max(0, seg.value);
              if (value <= 0) return null;
              const segH = (value / safeMax) * innerH;
              const y = pT + innerH - ((cursor + value) / safeMax) * innerH;
              cursor += value;
              const fill =
                seg.color ?? colorByKey.get(seg.key) ?? paletteFor(si);
              return (
                <rect
                  key={`${group.label}-${seg.key}-${si}`}
                  x={x}
                  y={y}
                  width={bw}
                  height={Math.max(0, segH)}
                  fill={fill}
                  rx={2}
                >
                  <title>
                    {group.label} · {seg.key}: {fmt(seg.value)}
                  </title>
                </rect>
              );
            })}
            <text
              x={cx}
              y={h - 10}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10.5 }}
            >
              {group.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
