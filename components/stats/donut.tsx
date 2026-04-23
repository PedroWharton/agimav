import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DonutTone = "ok" | "warn" | "danger" | "info" | "neutral" | "brand";

export type DonutSlice = {
  label: string;
  value: number;
  /** Explicit color (takes precedence over tone). Can be a CSS var() string. */
  color?: string;
  tone?: DonutTone;
};

/**
 * Map a tone to a CSS custom property reference. Keeps all color sourcing in
 * tokens — no hardcoded oklch/hex/rgb. Dark-mode overrides happen automatically
 * because globals.css already redefines the tokens under `.dark`.
 */
export function toneToColor(tone: DonutTone | undefined): string {
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

/** Fallback palette for slices with no color/tone — walks through tones in order. */
const FALLBACK_TONES: DonutTone[] = ["brand", "info", "ok", "warn", "danger", "neutral"];

function sliceColor(slice: DonutSlice, index: number): string {
  if (slice.color) return slice.color;
  if (slice.tone) return toneToColor(slice.tone);
  return toneToColor(FALLBACK_TONES[index % FALLBACK_TONES.length]);
}

/**
 * Generalized donut chart. Arcs are rendered as a single <path> per slice
 * using the SVG elliptical arc command, so the geometry works for any
 * innerRatio between 0 (pie) and <1.
 *
 * Legends are the caller's responsibility — consumers often want side-by-side
 * legend layout; baking one in forces opinions we regret.
 */
export function Donut({
  data,
  innerRatio = 0.62,
  centerLabel,
  size = 180,
  ariaLabel,
  className,
}: {
  data: DonutSlice[];
  innerRatio?: number;
  centerLabel?: ReactNode;
  size?: number;
  ariaLabel?: string;
  className?: string;
}) {
  const total = data.reduce((acc, s) => acc + Math.max(0, s.value), 0);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = Math.max(0, Math.min(rOuter - 1, rOuter * innerRatio));

  const renderCenter = (content: ReactNode) => (
    <foreignObject
      x={cx - rInner}
      y={cy - rInner}
      width={rInner * 2}
      height={rInner * 2}
      aria-hidden
    >
      <div className="flex h-full w-full items-center justify-center text-center">
        {content}
      </div>
    </foreignObject>
  );

  if (total <= 0) {
    return (
      <svg
        role="img"
        aria-label={ariaLabel ?? "Sin datos"}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn("block", className)}
      >
        <desc>Donut sin datos.</desc>
        <circle
          cx={cx}
          cy={cy}
          r={rOuter}
          fill="none"
          stroke="var(--border)"
          strokeWidth={Math.max(1, rOuter - rInner)}
          strokeDasharray="4 4"
          opacity={0.6}
        />
        {centerLabel ? renderCenter(centerLabel) : null}
      </svg>
    );
  }

  // Precompute cumulative ranges so the map callback is pure (React Compiler
  // rejects mid-render mutation of closure state).
  const prepared = data
    .map((slice, index) => ({ slice, index, fill: sliceColor(slice, index) }))
    .filter(({ slice }) => slice.value > 0);

  const ranges = prepared.reduce<
    Array<{ start: number; end: number; fill: string; label: string; value: number; index: number }>
  >((acc, { slice, index, fill }) => {
    const prevEnd = acc.length > 0 ? acc[acc.length - 1]!.end : 0;
    const portion = slice.value / total;
    acc.push({
      start: prevEnd,
      end: prevEnd + portion,
      fill,
      label: slice.label,
      value: slice.value,
      index,
    });
    return acc;
  }, []);

  const paths = ranges
    .map(({ start, end, fill, label, value, index }) => {
      const portion = end - start;
      const startAngle = start * 2 * Math.PI - Math.PI / 2;
      const endAngle = end * 2 * Math.PI - Math.PI / 2;

      // If one slice occupies 100% we can't draw it with the standard arc pair
      // (start==end), so render two concentric circles instead.
      if (portion >= 0.9999) {
        return {
          key: `${label}-${index}`,
          d: `M ${cx - rOuter} ${cy}
              A ${rOuter} ${rOuter} 0 1 1 ${cx + rOuter} ${cy}
              A ${rOuter} ${rOuter} 0 1 1 ${cx - rOuter} ${cy} Z
              M ${cx - rInner} ${cy}
              A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy}
              A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy} Z`,
          fill,
          portion,
          label,
          value,
        };
      }

      const largeArc = portion > 0.5 ? 1 : 0;
      const xOuterStart = cx + rOuter * Math.cos(startAngle);
      const yOuterStart = cy + rOuter * Math.sin(startAngle);
      const xOuterEnd = cx + rOuter * Math.cos(endAngle);
      const yOuterEnd = cy + rOuter * Math.sin(endAngle);
      const xInnerEnd = cx + rInner * Math.cos(endAngle);
      const yInnerEnd = cy + rInner * Math.sin(endAngle);
      const xInnerStart = cx + rInner * Math.cos(startAngle);
      const yInnerStart = cy + rInner * Math.sin(startAngle);

      const d = [
        `M ${xOuterStart} ${yOuterStart}`,
        `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xOuterEnd} ${yOuterEnd}`,
        `L ${xInnerEnd} ${yInnerEnd}`,
        `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xInnerStart} ${yInnerStart}`,
        "Z",
      ].join(" ");

      return {
        key: `${label}-${index}`,
        d,
        fill,
        portion,
        label,
        value,
      };
    });

  const summary = paths
    .map((p) => `${p.label} ${(p.portion * 100).toFixed(1)}%`)
    .join(", ");

  const centerContent = centerLabel ?? (
    <span className="font-mono text-sm font-semibold text-foreground">
      {total.toLocaleString("es-AR")}
    </span>
  );

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Distribución"}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("block", className)}
    >
      <desc>{summary}</desc>
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.fill}>
          <title>{`${p.label}: ${(p.portion * 100).toFixed(1)}%`}</title>
        </path>
      ))}
      {renderCenter(centerContent)}
    </svg>
  );
}
