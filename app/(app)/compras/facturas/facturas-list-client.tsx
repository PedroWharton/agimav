"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { Combobox } from "@/components/app/combobox";

export type FacturaRow = {
  id: number;
  numeroFactura: string;
  fechaFactura: string;
  proveedor: string;
  total: number;
  lineasCount: number;
};

const PROV_ALL = "__all__";

export function FacturasListClient({
  rows,
  proveedores,
}: {
  rows: FacturaRow[];
  proveedores: string[];
}) {
  const tFac = useTranslations("compras.facturas");
  const router = useRouter();
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (provFilter !== PROV_ALL && r.proveedor !== provFilter) return false;
      return true;
    });
  }, [rows, provFilter]);

  const columns: ColumnDef<FacturaRow>[] = [
    {
      accessorKey: "numeroFactura",
      header: tFac("campos.numero"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.numeroFactura}</span>
      ),
    },
    {
      accessorKey: "fechaFactura",
      header: tFac("campos.fecha"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(new Date(row.original.fechaFactura), "dd/MM/yyyy", {
            locale: es,
          })}
        </span>
      ),
    },
    {
      accessorKey: "proveedor",
      header: tFac("campos.proveedor"),
      enableSorting: true,
    },
    {
      accessorKey: "lineasCount",
      header: tFac("campos.lineas"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.lineasCount}</span>
      ),
    },
    {
      accessorKey: "total",
      header: tFac("campos.total"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.total.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tFac("titulo")}
        description={tFac("descripcion")}
        actions={
          <Button asChild>
            <Link href="/compras/facturas/nueva">{tFac("nueva")}</Link>
          </Button>
        }
      />

      <DataTable<FacturaRow>
        columns={columns}
        data={filtered}
        searchableKeys={["numeroFactura", "proveedor"]}
        searchPlaceholder={tFac("buscarPlaceholder")}
        initialSort={[{ id: "fechaFactura", desc: true }]}
        onRowClick={(row) => router.push(`/compras/facturas/${row.id}`)}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Combobox
              value={provFilter === PROV_ALL ? "" : provFilter}
              onChange={(v) => setProvFilter(v || PROV_ALL)}
              options={[
                { value: "", label: tFac("filtros.todos") },
                ...proveedores.map((p) => ({ value: p, label: p })),
              ]}
              placeholder={tFac("filtros.proveedor")}
              allowCreate={false}
              className="h-9 w-[240px]"
            />
            <span className="text-sm text-muted-foreground">
              {tFac("resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={
          rows.length === 0
            ? tFac("avisos.vacio")
            : tFac("avisos.vacioFiltrado")
        }
      />
    </div>
  );
}
