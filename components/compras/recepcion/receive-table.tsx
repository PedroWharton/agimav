"use client";

import { StatusChip, type ChipTone } from "@/components/app/status-chip";
import { EmptyState } from "@/components/app/states";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { QtyStepper } from "./qty-stepper";

export type ReceiveLine = {
  id: number;
  sku: string;
  nombre: string;
  pedidos: number;
  recibidosPrev: number;
  recibirAhora: number;
};

export type RowStatus = "ok" | "partial" | "short" | "pending";

export function rowStatus(line: ReceiveLine): RowStatus {
  const totalRecibido = line.recibidosPrev + line.recibirAhora;
  if (line.recibirAhora === 0) return "pending";
  if (totalRecibido === line.pedidos) return "ok";
  if (totalRecibido > line.pedidos) return "partial";
  return "short";
}

const ROW_TINT: Record<RowStatus, string> = {
  pending: "",
  ok: "bg-success-weak/30",
  partial: "bg-warn-weak/30",
  short: "bg-danger-weak/30",
};

const STATUS_TONE: Record<RowStatus, ChipTone> = {
  pending: "neutral",
  ok: "ok",
  partial: "warn",
  short: "danger",
};

const STATUS_LABEL: Record<RowStatus, string> = {
  pending: "Pendiente",
  ok: "Completo",
  partial: "Excedente",
  short: "Incompleto",
};

export type ReceiveTableProps = {
  lines: ReceiveLine[];
  onLineChange: (id: number, recibirAhora: number) => void;
  onSelectChange: (id: number, selected: boolean) => void;
  selectedIds: Set<number>;
  className?: string;
};

export function ReceiveTable({
  lines,
  onLineChange,
  onSelectChange,
  selectedIds,
  className,
}: ReceiveTableProps) {
  if (lines.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card", className)}>
        <EmptyState variant="no-data" title="Sin líneas pendientes" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="w-[40px] px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <span className="sr-only">Seleccionar</span>
            </th>
            <th className="w-[140px] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              SKU
            </th>
            <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Nombre
            </th>
            <th className="w-[90px] px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Pedido
            </th>
            <th className="w-[110px] px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Recibido prev.
            </th>
            <th className="w-[180px] px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Recibir
            </th>
            <th className="w-[130px] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const status = rowStatus(line);
            const isSelected = selectedIds.has(line.id);
            const qtyIsZero = line.recibirAhora === 0;
            return (
              <tr
                key={line.id}
                data-status={status}
                className={cn(
                  "border-b border-border transition-colors last:border-b-0",
                  ROW_TINT[status],
                )}
              >
                <td className="w-[40px] px-4 py-3 align-middle">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(c) => onSelectChange(line.id, c === true)}
                    aria-label={`Seleccionar ${line.sku}`}
                  />
                </td>
                <td className="px-3 py-3 align-middle">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {line.sku}
                  </span>
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="text-[13px] font-medium leading-tight">
                    {line.nombre}
                  </div>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {line.pedidos}
                  </span>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {line.recibidosPrev}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-center align-middle",
                    qtyIsZero && "text-subtle-foreground",
                  )}
                >
                  <div className="flex justify-center">
                    <QtyStepper
                      value={line.recibirAhora}
                      onChange={(v) => onLineChange(line.id, v)}
                      min={0}
                      size="sm"
                    />
                  </div>
                </td>
                <td className="px-3 py-3 align-middle">
                  <StatusChip
                    tone={STATUS_TONE[status]}
                    label={STATUS_LABEL[status]}
                    dot
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
