import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export type StockBadgeProps = {
  stock: number;
  stockMinimo?: number | null;
  unidad?: string | null;
  className?: string;
  showBar?: boolean;
};

function stockClass(stock: number, min: number): "negative" | "low" | "zero" | "ok" {
  if (stock < 0) return "negative";
  if (min > 0 && stock < min) return "low";
  if (stock === 0 && min === 0) return "zero";
  return "ok";
}

function pct(stock: number, min: number): number {
  if (min <= 0) return 60;
  return Math.max(4, Math.min(100, (stock / (min * 2)) * 100));
}

export function StockBadge({
  stock,
  stockMinimo,
  unidad,
  className,
  showBar = true,
}: StockBadgeProps) {
  const min = stockMinimo ?? 0;
  const cls = stockClass(stock, min);
  const unitLabel = unidad?.trim() || "";

  const barBase =
    "relative inline-block h-1 w-[60px] shrink-0 self-center rounded-full bg-muted-2 overflow-hidden mr-1";
  const barFillBase =
    "absolute inset-y-0 left-0 rounded-full";

  if (cls === "negative") {
    return (
      <span
        className={cn(
          "inline-flex items-baseline justify-end gap-1.5 tabular-nums text-danger",
          className,
        )}
        title="Stock negativo — revisar"
      >
        <span className="rounded-md bg-danger-weak px-2 py-0.5 text-[11.5px] font-semibold leading-tight text-danger">
          −{formatNumber(Math.abs(stock))}
        </span>
        {unitLabel ? (
          <span className="text-[11px] lowercase text-muted-foreground">
            {unitLabel}
          </span>
        ) : null}
      </span>
    );
  }

  if (cls === "zero") {
    return (
      <span
        className={cn(
          "inline-flex items-baseline justify-end gap-1.5 tabular-nums text-muted-foreground",
          className,
        )}
      >
        <span className="font-semibold">0</span>
        {unitLabel ? (
          <span className="text-[11px] lowercase text-muted-foreground">
            {unitLabel}
          </span>
        ) : null}
      </span>
    );
  }

  const fillPct = pct(stock, min);
  const fillColor = cls === "low" ? "bg-warn" : "bg-success";

  return (
    <span
      className={cn(
        "inline-flex items-baseline justify-end gap-1.5 tabular-nums",
        cls === "low" && "text-warn",
        className,
      )}
      title={cls === "low" ? `Bajo mínimo (${formatNumber(min)})` : undefined}
    >
      {showBar ? (
        <span className={barBase} aria-hidden="true">
          <span
            className={cn(barFillBase, fillColor)}
            style={{ width: `${fillPct}%` }}
          />
        </span>
      ) : null}
      <span className="font-semibold">
        {formatNumber(stock)}
        {cls === "low" ? (
          <span className="font-normal text-muted-foreground">
            /{formatNumber(min)}
          </span>
        ) : null}
      </span>
      {unitLabel ? (
        <span className="text-[11px] lowercase text-muted-foreground">
          {unitLabel}
        </span>
      ) : null}
    </span>
  );
}
