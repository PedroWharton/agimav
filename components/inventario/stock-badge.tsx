import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export type StockBadgeProps = {
  stock: number;
  stockMinimo?: number | null;
  unidad?: string | null;
  className?: string;
};

export function StockBadge({ stock, stockMinimo, unidad, className }: StockBadgeProps) {
  const min = stockMinimo ?? 0;
  const negative = stock < 0;
  const belowMin = min > 0 && stock < min;

  const label = negative
    ? `−${formatNumber(Math.abs(stock))}`
    : belowMin
      ? `${formatNumber(stock)}/${formatNumber(min)}`
      : formatNumber(stock);

  const unitSuffix = unidad ? ` ${unidad}` : "";

  if (negative) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-destructive/15 px-2 py-0.5 text-destructive font-semibold tabular-nums",
          className,
        )}
        title="Stock negativo — revisar"
      >
        {label}
        <span className="ml-1 text-xs opacity-75">{unitSuffix.trim()}</span>
      </span>
    );
  }

  if (belowMin) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-destructive/30 px-2 py-0.5 text-destructive tabular-nums",
          className,
        )}
        title={`Bajo mínimo (${formatNumber(min)})`}
      >
        {label}
        <span className="ml-1 text-xs opacity-75">{unitSuffix.trim()}</span>
      </span>
    );
  }

  if (stock === 0 && min === 0) {
    return (
      <span className={cn("tabular-nums text-muted-foreground", className)}>
        0<span className="ml-1 text-xs">{unitSuffix.trim()}</span>
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {label}
      <span className="ml-1 text-xs text-muted-foreground">{unitSuffix.trim()}</span>
    </span>
  );
}
