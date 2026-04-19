"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";

export type PlantillaRow = {
  id: number;
  nombre: string;
  tipoMaquinariaId: number;
  tipoMaquinariaNombre: string;
  frecuenciaValor: number;
  frecuenciaUnidad: string;
  prioridad: string;
  creadoPor: string | null;
  fechaCreacion: string;
  insumosCount: number;
  tareasCount: number;
  mantenimientosCount: number;
};

const ALL = "__all__";

export function PlantillasClient({
  rows,
  isAdmin,
}: {
  rows: PlantillaRow[];
  isAdmin: boolean;
}) {
  const tM = useTranslations("mantenimiento");
  const tP = useTranslations("mantenimiento.plantillas");
  const router = useRouter();

  const [tipoFilter, setTipoFilter] = useState(ALL);

  const tipoOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of rows) seen.set(r.tipoMaquinariaId, r.tipoMaquinariaNombre);
    return Array.from(seen, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tipoFilter !== ALL && String(r.tipoMaquinariaId) !== tipoFilter) {
        return false;
      }
      return true;
    });
  }, [rows, tipoFilter]);

  const columns: ColumnDef<PlantillaRow>[] = [
    {
      accessorKey: "nombre",
      header: tP("columnas.nombre"),
      enableSorting: true,
    },
    {
      accessorKey: "tipoMaquinariaNombre",
      header: tP("columnas.tipoMaquinaria"),
      enableSorting: true,
    },
    {
      accessorKey: "frecuenciaValor",
      header: tP("columnas.frecuencia"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.frecuenciaValor}{" "}
          <span className="text-xs text-muted-foreground">
            {row.original.frecuenciaUnidad}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "insumosCount",
      header: tP("columnas.insumos"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.insumosCount}</span>
      ),
    },
    {
      accessorKey: "tareasCount",
      header: tP("columnas.tareas"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.tareasCount}</span>
      ),
    },
    {
      accessorKey: "mantenimientosCount",
      header: tP("columnas.aplicaciones"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.mantenimientosCount}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tP("titulo")}
        description={tP("descripcion")}
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/mantenimiento/plantillas/nueva">
                <Plus className="size-4" />
                {tP("nueva")}
              </Link>
            </Button>
          ) : null
        }
      />

      <DataTable<PlantillaRow>
        columns={columns}
        data={filtered}
        searchableKeys={["nombre", "tipoMaquinariaNombre"]}
        searchPlaceholder={tP("buscarPlaceholder")}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={(row) =>
          router.push(`/mantenimiento/plantillas/${row.id}`)
        }
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder={tP("filtros.tipoMaquinaria")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tM("filtros.todos")}</SelectItem>
                {tipoOptions.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {tP("resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={tP("vacio")}
      />
    </div>
  );
}
