import { cn } from "@/lib/utils";

export function SparkLine({
  values,
  labels,
  width = 240,
  height = 48,
  className,
}: {
  values: number[];
  labels?: string[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!values.length) {
    return (
      <div
        className={cn("text-xs text-muted-foreground", className)}
        style={{ height }}
      >
        —
      </div>
    );
  }

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return { x, y, v };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1]!;

  return (
    <svg
      role="img"
      aria-label="Tendencia"
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block text-sky-600 dark:text-sky-400", className)}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill="currentColor" />
      {labels
        ? points.map((p, i) => (
            <title key={i}>
              {labels[i] ?? ""}: {p.v.toLocaleString("es-AR")}
            </title>
          ))
        : null}
    </svg>
  );
}
