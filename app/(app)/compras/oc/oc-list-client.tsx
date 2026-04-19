"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { Combobox } from "@/components/app/combobox";
import { EstadoChip } from "@/components/compras/estado-chip";

export type OcRow = {
  id: number;
  numeroOc: string | null;
  fechaEmision: string;
  proveedor: string;
  comprador: string | null;
  estado: string;
  totalEstimado: number;
  lineasCount: number;
};

const ESTADO_ALL = "__all__";
const PROV_ALL = "__all__";

const ESTADO_OPTIONS = [
  "Emitida",
  "Parcialmente Recibida",
  "Completada",
  "Cancelada",
] as const;

export function OcListClient({
  rows,
  proveedores,
}: {
  rows: OcRow[];
  proveedores: string[];
}) {
  const tOc = useTranslations("compras.oc");
  const tEstados = useTranslations("compras.common.estados");
  const router = useRouter();

  const [estadoFilter, setEstadoFilter] = useState<string>(ESTADO_ALL);
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (estadoFilter !== ESTADO_ALL && r.estado !== estadoFilter)
        return false;
      if (provFilter !== PROV_ALL && r.proveedor !== provFilter) return false;
      return true;
    });
  }, [rows, estadoFilter, provFilter]);

  const columns: ColumnDef<OcRow>[] = [
    {
      accessorKey: "numeroOc",
      header: tOc("campos.numero"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.numeroOc ?? `#${row.original.id}`}
        </span>
      ),
    },
    {
      accessorKey: "fechaEmision",
      header: tOc("campos.fechaEmision"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(new Date(row.original.fechaEmision), "dd/MM/yyyy", {
            locale: es,
          })}
        </span>
      ),
    },
    {
      accessorKey: "proveedor",
      header: tOc("campos.proveedor"),
      enableSorting: true,
    },
    {
      accessorKey: "comprador",
      header: tOc("campos.comprador"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.comprador || (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "lineasCount",
      header: tOc("campos.lineas"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.lineasCount}</span>
      ),
    },
    {
      accessorKey: "estado",
      header: tOc("campos.estado"),
      enableSorting: true,
      cell: ({ row }) => <EstadoChip estado={row.original.estado} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tOc("titulo")}
        description={tOc("descripcion")}
      />

      <DataTable<OcRow>
        columns={columns}
        data={filtered}
        searchableKeys={["proveedor", "comprador", "numeroOc"]}
        searchPlaceholder={tOc("buscarPlaceholder")}
        initialSort={[{ id: "numeroOc", desc: true }]}
        onRowClick={(row) => router.push(`/compras/oc/${row.id}`)}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={estadoFilter}
              onValueChange={(v) => setEstadoFilter(v || ESTADO_ALL)}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder={tOc("filtros.estado")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ESTADO_ALL}>
                  {tOc("filtros.todos")}
                </SelectItem>
                {ESTADO_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {tEstados(estadoKeyFor(e))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Combobox
              value={provFilter === PROV_ALL ? "" : provFilter}
              onChange={(v) => setProvFilter(v || PROV_ALL)}
              options={[
                { value: "", label: tOc("filtros.todos") },
                ...proveedores.map((p) => ({ value: p, label: p })),
              ]}
              placeholder={tOc("filtros.proveedor")}
              allowCreate={false}
              className="h-9 w-[240px]"
            />
            <span className="text-sm text-muted-foreground">
              {tOc("resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={
          rows.length === 0 ? tOc("avisos.vacio") : tOc("avisos.vacioFiltrado")
        }
      />
    </div>
  );
}

function estadoKeyFor(estado: string): string {
  const map: Record<string, string> = {
    Emitida: "Emitida",
    "Parcialmente Recibida": "ParcialmenteRecibida",
    Completada: "Completada",
    Cancelada: "Cancelada",
  };
  return map[estado] ?? estado;
}
