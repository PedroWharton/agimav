import { cn } from "@/lib/utils";

type Point = {
  fecha: string; // YYYY-MM-DD
  precioArs: number;
  precioUsd: number | null;
};

export function PriceChart({
  points,
  dolarFrom,
  width = 640,
  height = 280,
  className,
}: {
  points: Point[];
  dolarFrom: string | null; // YYYY-MM; all points with fecha < this are ARS-only
  width?: number;
  height?: number;
  className?: string;
}) {
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 48;
  const padRight = 48;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground",
          className,
        )}
        style={{ width, height }}
      >
        Sin datos en el período.
      </div>
    );
  }

  const fechas = points.map((p) => new Date(p.fecha).getTime());
  const tMin = Math.min(...fechas);
  const tMax = Math.max(...fechas);
  const tRange = tMax - tMin || 1;

  const arsMax = Math.max(...points.map((p) => p.precioArs), 1);
  const usdValues = points
    .map((p) => p.precioUsd)
    .filter((v): v is number => v !== null && v > 0);
  const usdMax = usdValues.length > 0 ? Math.max(...usdValues, 1) : 1;

  const xForT = (t: number) =>
    padLeft + ((t - tMin) / tRange) * innerW;
  const yForArs = (v: number) => padTop + innerH - (v / arsMax) * innerH;
  const yForUsd = (v: number) => padTop + innerH - (v / usdMax) * innerH;

  const arsPoints = points.map((p) => ({
    x: xForT(new Date(p.fecha).getTime()),
    y: yForArs(p.precioArs),
    v: p.precioArs,
  }));
  const arsPath = arsPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const usdPointsOnly = points
    .filter((p) => p.precioUsd !== null && p.precioUsd > 0)
    .map((p) => ({
      x: xForT(new Date(p.fecha).getTime()),
      y: yForUsd(p.precioUsd as number),
      v: p.precioUsd as number,
    }));
  const usdPath = usdPointsOnly.map((p) => `${p.x},${p.y}`).join(" ");

  const sinTcBandEnd = dolarFrom
    ? xForT(new Date(`${dolarFrom}-01`).getTime())
    : null;
  const showSinTcBand =
    sinTcBandEnd !== null && sinTcBandEnd > padLeft + 1;

  const arsTicks = 4;
  const arsTickValues = Array.from(
    { length: arsTicks + 1 },
    (_, i) => (arsMax * i) / arsTicks,
  );

  const formatArs = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `${(v / 1_000).toFixed(0)}k`
        : v.toFixed(0);
  const formatUsd = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  const firstFecha = points[0]!.fecha.slice(0, 7);
  const lastFecha = points[points.length - 1]!.fecha.slice(0, 7);

  return (
    <svg
      role="img"
      aria-label="Evolución de precios"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-sky-600 dark:text-sky-400", className)}
    >
      {showSinTcBand ? (
        <>
          <rect
            x={padLeft}
            y={padTop}
            width={sinTcBandEnd - padLeft}
            height={innerH}
            className="fill-muted/40"
          />
          <text
            x={padLeft + 4}
            y={padTop + 12}
            className="fill-muted-foreground"
            fontSize={10}
          >
            sin tipo de cambio
          </text>
        </>
      ) : null}

      {arsTickValues.map((tv, i) => (
        <g key={`grid-${i}`}>
          <line
            x1={padLeft}
            x2={padLeft + innerW}
            y1={yForArs(tv)}
            y2={yForArs(tv)}
            className="stroke-border"
            strokeWidth={0.5}
          />
          <text
            x={padLeft - 6}
            y={yForArs(tv) + 3}
            textAnchor="end"
            fontSize={10}
            className="fill-muted-foreground"
          >
            ${formatArs(tv)}
          </text>
        </g>
      ))}

      {usdValues.length > 0
        ? arsTickValues.map((_, i) => {
            const usdTv = (usdMax * i) / arsTicks;
            return (
              <text
                key={`usd-tick-${i}`}
                x={padLeft + innerW + 6}
                y={yForUsd(usdTv) + 3}
                fontSize={10}
                className="fill-amber-700 dark:fill-amber-400"
              >
                US${formatUsd(usdTv)}
              </text>
            );
          })
        : null}

      {arsPoints.length > 1 ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={arsPath}
        />
      ) : null}
      {arsPoints.map((p, i) => (
        <circle
          key={`ars-${i}`}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="currentColor"
        >
          <title>{`${points[i]!.fecha}: ARS ${p.v.toLocaleString("es-AR")}`}</title>
        </circle>
      ))}

      {usdPointsOnly.length > 1 ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={usdPath}
          className="text-amber-600 dark:text-amber-400"
        />
      ) : null}
      {usdPointsOnly.map((p, i) => (
        <circle
          key={`usd-${i}`}
          cx={p.x}
          cy={p.y}
          r={2.5}
          className="fill-amber-600 dark:fill-amber-400"
        >
          <title>USD {p.v.toFixed(2)}</title>
        </circle>
      ))}

      <text
        x={padLeft}
        y={height - 6}
        fontSize={10}
        className="fill-muted-foreground"
      >
        {firstFecha}
      </text>
      <text
        x={padLeft + innerW}
        y={height - 6}
        textAnchor="end"
        fontSize={10}
        className="fill-muted-foreground"
      >
        {lastFecha}
      </text>
    </svg>
  );
}
