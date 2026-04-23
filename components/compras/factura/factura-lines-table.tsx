"use client";

import type { JSX } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/app/currency-input";
import { NumberInput } from "@/components/app/number-input";
import { cn } from "@/lib/utils";

import { IvaPicker } from "./iva-picker";
import { OcLinkChip } from "./oc-link-chip";

export type FacturaLine = {
  id: string;
  ocDetalleId?: number | null;
  sku?: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  iva: number;
  ocPrecioUnitario?: number;
  ocCantidad?: number;
  /** Optional OC number to display on the link chip. Defaults to `OC-${ocDetalleId}`. */
  ocNumero?: string;
};

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function formatARS(value: number): string {
  if (!Number.isFinite(value)) return "ARS —";
  return ARS_FORMATTER.format(value);
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3.5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function FacturaLinesTable({
  lines,
  onChange,
  onAdd,
  onRemove,
  showIva = true,
}: {
  lines: FacturaLine[];
  onChange: (id: string, patch: Partial<FacturaLine>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  /**
   * When false, hides the IVA column (used for tipo C / X facturas).
   * Defaults to true.
   */
  showIva?: boolean;
}): JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-muted">
            <Th className="w-[120px]">SKU</Th>
            <Th>Descripción</Th>
            <Th className="w-[90px] text-right">Cantidad</Th>
            <Th className="w-[140px] text-right">Precio unit.</Th>
            {showIva ? <Th className="w-[100px] text-right">IVA</Th> : null}
            <Th className="w-[140px] text-right">Subtotal</Th>
            <Th className="w-[40px]" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const priceDiff =
              typeof line.ocPrecioUnitario === "number" &&
              line.precioUnitario !== line.ocPrecioUnitario;
            const qtyDiff =
              typeof line.ocCantidad === "number" &&
              line.cantidad !== line.ocCantidad;
            const subtotal = line.cantidad * line.precioUnitario;

            const linked =
              typeof line.ocDetalleId === "number" && line.ocDetalleId !== null;

            return (
              <tr
                key={line.id}
                data-diff={priceDiff || qtyDiff ? "true" : undefined}
                className="border-b border-dashed border-border last:border-b-0 last:border-solid"
              >
                <td className="px-3.5 py-2.5 align-middle">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {line.sku ?? "—"}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 align-middle">
                  <div className="flex flex-col gap-1">
                    <span className="truncate text-[13px] font-medium">
                      {line.nombre}
                    </span>
                    {linked ? (
                      <OcLinkChip
                        ocNumero={line.ocNumero ?? `OC-${line.ocDetalleId}`}
                        ocDetalleId={line.ocDetalleId as number}
                      />
                    ) : (
                      <span className="text-[11px] text-subtle-foreground">
                        Sin OC
                      </span>
                    )}
                  </div>
                </td>
                <td
                  data-diff={qtyDiff ? "true" : undefined}
                  className={cn(
                    "px-3.5 py-2.5 text-right align-middle",
                    qtyDiff && "bg-warn-weak/40 text-warn",
                  )}
                >
                  <NumberInput
                    value={Number.isFinite(line.cantidad) ? line.cantidad : 0}
                    min={0}
                    step={1}
                    onChange={(v) =>
                      onChange(line.id, {
                        cantidad: Math.max(0, v === "" ? 0 : v),
                      })
                    }
                    className="h-7 font-mono text-[12.5px]"
                    aria-label={`Cantidad ${line.nombre}`}
                  />
                  {qtyDiff ? (
                    <div className="mt-1 text-[10.5px] font-medium text-warn">
                      OC: {line.ocCantidad}
                    </div>
                  ) : null}
                </td>
                <td
                  data-diff={priceDiff ? "true" : undefined}
                  className={cn(
                    "px-3.5 py-2.5 text-right align-middle",
                    priceDiff && "bg-warn-weak/40 text-warn",
                  )}
                >
                  <CurrencyInput
                    value={
                      Number.isFinite(line.precioUnitario)
                        ? line.precioUnitario
                        : 0
                    }
                    onChange={(v) =>
                      onChange(line.id, {
                        precioUnitario: Math.max(0, v === "" ? 0 : v),
                      })
                    }
                    className="h-7 font-mono text-[12.5px]"
                    aria-label={`Precio unitario ${line.nombre}`}
                  />
                  {priceDiff ? (
                    <div className="mt-1 text-[10.5px] font-medium text-warn">
                      OC: {formatARS(line.ocPrecioUnitario as number)}
                    </div>
                  ) : null}
                </td>
                {showIva ? (
                  <td className="px-3.5 py-2.5 text-right align-middle">
                    <IvaPicker
                      value={line.iva}
                      onChange={(v) => onChange(line.id, { iva: v })}
                      aria-label={`IVA ${line.nombre}`}
                      className="ml-auto"
                    />
                  </td>
                ) : null}
                <td className="px-3.5 py-2.5 text-right align-middle font-mono text-[12.5px] font-semibold tabular-nums">
                  {formatARS(subtotal)}
                </td>
                <td className="px-2 py-2.5 text-right align-middle">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${line.nombre}`}
                    onClick={() => onRemove(line.id)}
                    className="text-muted-foreground hover:bg-danger-weak hover:text-danger"
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-2 border-t border-border bg-muted-2 px-3.5 py-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
        >
          <Plus />
          Agregar línea
        </Button>
      </div>
    </div>
  );
}
