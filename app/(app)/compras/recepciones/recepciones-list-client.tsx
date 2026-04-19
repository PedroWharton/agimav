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

export type RecepcionRow = {
  id: number;
  numeroRemito: string;
  fechaRecepcion: string;
  recibidoPor: string;
  ocId: number;
  ocNumero: string;
  proveedor: string;
  lineasCount: number;
};

const PROV_ALL = "__all__";

export function RecepcionesListClient({
  rows,
  proveedores,
}: {
  rows: RecepcionRow[];
  proveedores: string[];
}) {
  const tRec = useTranslations("compras.recepciones");
  const router = useRouter();

  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (provFilter !== PROV_ALL && r.proveedor !== provFilter) return false;
      return true;
    });
  }, [rows, provFilter]);

  const columns: ColumnDef<RecepcionRow>[] = [
    {
      accessorKey: "numeroRemito",
      header: tRec("campos.remito"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.numeroRemito}</span>
      ),
    },
    {
      accessorKey: "fechaRecepcion",
      header: tRec("campos.fecha"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(new Date(row.original.fechaRecepcion), "dd/MM/yyyy", {
            locale: es,
          })}
        </span>
      ),
    },
    {
      accessorKey: "ocNumero",
      header: tRec("campos.oc"),
      cell: ({ row }) => (
        <Link
          href={`/compras/oc/${row.original.ocId}`}
          className="font-mono text-xs underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.ocNumero}
        </Link>
      ),
    },
    {
      accessorKey: "proveedor",
      header: tRec("campos.proveedor"),
      enableSorting: true,
    },
    {
      accessorKey: "recibidoPor",
      header: tRec("campos.recibidoPor"),
      enableSorting: true,
    },
    {
      accessorKey: "lineasCount",
      header: tRec("campos.lineas"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.lineasCount}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tRec("titulo")}
        description={tRec("descripcion")}
        actions={
          <Button asChild>
            <Link href="/compras/oc">{tRec("nuevaDesdeOc")}</Link>
          </Button>
        }
      />

      <DataTable<RecepcionRow>
        columns={columns}
        data={filtered}
        searchableKeys={["numeroRemito", "proveedor", "recibidoPor", "ocNumero"]}
        searchPlaceholder={tRec("buscarPlaceholder")}
        initialSort={[{ id: "fechaRecepcion", desc: true }]}
        onRowClick={(row) => router.push(`/compras/recepciones/${row.id}`)}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Combobox
              value={provFilter === PROV_ALL ? "" : provFilter}
              onChange={(v) => setProvFilter(v || PROV_ALL)}
              options={[
                { value: "", label: tRec("filtros.todos") },
                ...proveedores.map((p) => ({ value: p, label: p })),
              ]}
              placeholder={tRec("filtros.proveedor")}
              allowCreate={false}
              className="h-9 w-[240px]"
            />
            <span className="text-sm text-muted-foreground">
              {tRec("resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={
          rows.length === 0
            ? tRec("avisos.vacio")
            : tRec("avisos.vacioFiltrado")
        }
      />
    </div>
  );
}
