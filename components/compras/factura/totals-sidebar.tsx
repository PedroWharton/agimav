"use client";

import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const IVA_LABEL_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatARS(value: number): string {
  if (!Number.isFinite(value)) return "ARS —";
  return ARS_FORMATTER.format(value);
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border py-1.5 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-[12.5px] font-medium tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TotalsSidebar({
  subtotalNeto,
  ivaPorAlicuota,
  total,
  ocTotal,
  showIva = true,
}: {
  subtotalNeto: number;
  ivaPorAlicuota: Record<number, number>;
  total: number;
  ocTotal?: number;
  /**
   * When false, hides the IVA breakdown rows (used for tipo C / X facturas,
   * where IVA is not itemized).
   */
  showIva?: boolean;
}): JSX.Element {
  const ivaRows = showIva
    ? Object.entries(ivaPorAlicuota)
        .map(([rate, amount]) => ({ rate: Number(rate), amount }))
        .filter((row) => Number.isFinite(row.amount) && row.amount !== 0)
        .sort((a, b) => a.rate - b.rate)
    : [];

  const diff = typeof ocTotal === "number" ? total - ocTotal : undefined;
  const hasDiff = typeof diff === "number";
  const diffZero = hasDiff && Math.abs(diff as number) < 0.005;

  return (
    <Card
      size="sm"
      className="sticky top-4 flex flex-col gap-3 p-4"
      data-slot="totals-sidebar"
    >
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Totales
      </h4>

      <Row label="Subtotal neto" value={formatARS(subtotalNeto)} />

      {showIva ? (
        ivaRows.length === 0 ? (
          <Row
            label="IVA"
            value={<span className="text-subtle-foreground">—</span>}
          />
        ) : (
          ivaRows.map(({ rate, amount }) => (
            <Row
              key={rate}
              label={`IVA ${IVA_LABEL_FORMATTER.format(rate)}%`}
              value={formatARS(amount)}
            />
          ))
        )
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[13px] font-semibold text-foreground">Total</span>
        <span className="font-mono text-[16px] font-semibold tabular-nums">
          {formatARS(total)}
        </span>
      </div>

      {hasDiff ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[12px]",
            diffZero
              ? "bg-success-weak text-success"
              : "bg-warn-weak text-warn",
          )}
          data-diff={diffZero ? "zero" : "nonzero"}
        >
          <span className="font-medium">Diferencia vs OC</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatARS(diff as number)}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
