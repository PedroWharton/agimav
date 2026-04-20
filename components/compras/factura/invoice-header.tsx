"use client";

import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type FacturaTipo = "A" | "B" | "C" | "X";

const TIPOS: FacturaTipo[] = ["A", "B", "C", "X"];

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

function ProveedorChip({
  proveedor,
}: {
  proveedor: { id: number; nombre: string };
}) {
  const cod = proveedor.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5",
      )}
      data-slot="proveedor-chip"
      aria-label={`Proveedor ${proveedor.nombre}`}
    >
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-weak font-mono text-[11px] font-semibold text-brand">
        {cod || "·"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-tight">
          {proveedor.nombre}
        </div>
        <div className="truncate font-mono text-[11px] text-subtle-foreground">
          ID {proveedor.id}
        </div>
      </div>
    </div>
  );
}

export function InvoiceHeader({
  tipo,
  onTipoChange,
  puntoDeVenta,
  onPuntoDeVentaChange,
  numero,
  onNumeroChange,
  fecha,
  onFechaChange,
  proveedor,
}: {
  tipo: FacturaTipo;
  onTipoChange: (t: FacturaTipo) => void;
  puntoDeVenta: string;
  onPuntoDeVentaChange: (v: string) => void;
  numero: string;
  onNumeroChange: (v: string) => void;
  fecha: string;
  onFechaChange: (v: string) => void;
  proveedor: { id: number; nombre: string };
}): JSX.Element {
  return (
    <Card
      size="sm"
      className="grid grid-cols-[140px_1fr_1fr_1fr] items-end gap-4 p-5"
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Tipo</FieldLabel>
        <ToggleGroup
          type="single"
          value={tipo}
          onValueChange={(next) => {
            if (!next) return;
            onTipoChange(next as FacturaTipo);
          }}
          className="h-8 p-0.5"
          aria-label="Tipo de factura"
        >
          {TIPOS.map((t) => (
            <ToggleGroupItem
              key={t}
              value={t}
              className={cn(
                "h-7 w-7 font-mono text-[12px] font-semibold",
                "data-[state=on]:bg-brand data-[state=on]:text-white",
              )}
            >
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="factura-pto-venta">Punto de venta</FieldLabel>
        <Input
          id="factura-pto-venta"
          inputMode="numeric"
          value={puntoDeVenta}
          onChange={(e) => onPuntoDeVentaChange(e.target.value)}
          className="font-mono text-[13px]"
          placeholder="0001"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="factura-numero">Número</FieldLabel>
        <Input
          id="factura-numero"
          inputMode="numeric"
          value={numero}
          onChange={(e) => onNumeroChange(e.target.value)}
          className="font-mono text-[13px] font-semibold"
          placeholder="00001234"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="factura-fecha">Fecha</FieldLabel>
        <Input
          id="factura-fecha"
          type="date"
          value={fecha}
          onChange={(e) => onFechaChange(e.target.value)}
          className="font-mono text-[13px]"
        />
      </div>

      <div className="col-span-full flex flex-col gap-1.5">
        <FieldLabel>Proveedor</FieldLabel>
        <ProveedorChip proveedor={proveedor} />
      </div>
    </Card>
  );
}
