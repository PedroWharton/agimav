import { cn } from "@/lib/utils";

type Slice = {
  label: string;
  value: number;
  classColor: string;
};

export function AbcPie({
  a,
  b,
  c,
  size = 180,
}: {
  a: number;
  b: number;
  c: number;
  size?: number;
}) {
  const total = a + b + c;
  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }

  const slices: Slice[] = [
    { label: "A", value: a, classColor: "text-sky-600 dark:text-sky-400" },
    { label: "B", value: b, classColor: "text-amber-600 dark:text-amber-400" },
    { label: "C", value: c, classColor: "text-muted-foreground" },
  ].filter((s) => s.value > 0);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  let cumulative = 0;
  const paths = slices.map((s) => {
    const portion = s.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += portion;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = portion > 0.5 ? 1 : 0;
    const d =
      slices.length === 1
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...s, d, portion };
  });

  return (
    <svg
      role="img"
      aria-label="Distribución ABC"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {paths.map((p) => (
        <path
          key={p.label}
          d={p.d}
          className={cn("fill-current", p.classColor)}
        >
          <title>
            {p.label}: {(p.portion * 100).toFixed(1)}%
          </title>
        </path>
      ))}
    </svg>
  );
}
