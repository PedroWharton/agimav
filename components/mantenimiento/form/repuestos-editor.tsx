"use client";

import { Info, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NumberInput } from "@/components/app/number-input";
import { cn } from "@/lib/utils";

export type RepuestoLine = {
  /** Local row id — keeps React keys stable regardless of insumoId. */
  id: string;
  insumoId: number | null;
  sku?: string;
  nombre?: string;
  stockDisponible?: number;
  qty: number;
  unitCost?: number;
};

export type InsumoPickerOption = {
  id: number;
  sku: string;
  nombre: string;
  stock: number;
  unitCost?: number;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function nextLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Inline repuestos table (§4.11). Fully controlled — parent owns the `lines`
 * array. Renders one row per line with SKU / name / stock / qty stepper /
 * subtotal, plus a search picker that appends new lines. The bottom info
 * banner reinforces the reserved-not-consumed semantics.
 */
export function RepuestosEditor({
  lines,
  onChange,
  insumoOptions,
  className,
}: {
  lines: RepuestoLine[];
  onChange: (lines: RepuestoLine[]) => void;
  insumoOptions: InsumoPickerOption[];
  className?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const takenIds = useMemo(
    () => new Set(lines.map((l) => l.insumoId).filter((v): v is number => v != null)),
    [lines],
  );
  const availableOptions = useMemo(
    () => insumoOptions.filter((o) => !takenIds.has(o.id)),
    [insumoOptions, takenIds],
  );

  const patchLine = (id: string, patch: Partial<RepuestoLine>) => {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((l) => l.id !== id));
  };

  const addLineFromOption = (opt: InsumoPickerOption) => {
    const line: RepuestoLine = {
      id: nextLineId(),
      insumoId: opt.id,
      sku: opt.sku,
      nombre: opt.nombre,
      stockDisponible: opt.stock,
      qty: 1,
      unitCost: opt.unitCost,
    };
    onChange([...lines, line]);
    setPickerOpen(false);
  };

  const clampQty = (value: number) => Math.max(1, value);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-[10.5px] uppercase tracking-wider text-subtle-foreground">
            <tr>
              <th className="w-[120px] px-3 py-2 text-left font-semibold">SKU</th>
              <th className="px-3 py-2 text-left font-semibold">Nombre</th>
              <th className="w-[100px] px-3 py-2 text-left font-semibold">
                Disponible
              </th>
              <th className="w-[140px] px-3 py-2 text-left font-semibold">
                Cantidad
              </th>
              <th className="w-[110px] px-3 py-2 text-right font-semibold">
                Subtotal
              </th>
              <th className="w-8 px-2 py-2" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-xs text-subtle-foreground"
                >
                  Sin repuestos agregados.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const subtotal =
                  line.unitCost != null ? line.qty * line.unitCost : null;
                return (
                  <tr
                    key={line.id}
                    className="border-t border-border align-middle"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-subtle-foreground">
                      {line.sku ?? "—"}
                    </td>
                    <td className="px-3 py-2">{line.nombre ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-subtle-foreground">
                      {line.stockDisponible != null
                        ? `${line.stockDisponible} disp.`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <NumberInput
                        steppers
                        stepAmount={1}
                        min={1}
                        value={line.qty}
                        onChange={(v) =>
                          patchLine(line.id, {
                            qty: clampQty(v === "" ? 1 : v),
                          })
                        }
                        className="h-8 w-[130px] font-mono text-xs"
                      />
                      {line.stockDisponible != null &&
                      line.qty > line.stockDisponible ? (
                        <div className="mt-1 text-[10.5px] font-medium text-warn">
                          Supera stock ({line.stockDisponible} disp.)
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                      {subtotal != null ? ARS.format(subtotal) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Quitar"
                        onClick={() => removeLine(line.id)}
                        className="text-subtle-foreground hover:text-danger"
                      >
                        <X />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
          >
            <Plus />
            Agregar repuesto
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          {availableOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-subtle-foreground">
              Sin insumos disponibles
            </div>
          ) : (
            <Command>
              <CommandInput placeholder="Buscar por SKU o nombre…" />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  {availableOptions.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={`${opt.sku} ${opt.nombre}`}
                      onSelect={() => addLineFromOption(opt)}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-subtle-foreground">
                          {opt.sku}
                        </span>
                        <span className="text-sm">{opt.nombre}</span>
                        <span className="text-[11px] text-subtle-foreground">
                          {opt.stock} disp.
                          {opt.unitCost != null
                            ? ` · ${ARS.format(opt.unitCost)}`
                            : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      <div className="flex items-start gap-2 rounded-lg border border-info-weak bg-info-weak px-3 py-2 text-xs text-info">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p className="leading-relaxed">
          Las cantidades se reservan al crear la OT, pero solo se descuentan
          del stock al consumirlas.
        </p>
      </div>
    </div>
  );
}
