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
import { Toolbar } from "@/components/app/toolbar";

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

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function PlantillasClient({
  rows,
  canManage,
}: {
  rows: PlantillaRow[];
  canManage: boolean;
}) {
  const tM = useTranslations("mantenimiento");
  const tP = useTranslations("mantenimiento.plantillas");
  const router = useRouter();

  const [tipoFilter, setTipoFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const tipoOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of rows) seen.set(r.tipoMaquinariaId, r.tipoMaquinariaNombre);
    return Array.from(seen, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (tipoFilter !== ALL) {
      out = out.filter((r) => String(r.tipoMaquinariaId) === tipoFilter);
    }
    const q = search.trim();
    if (q) {
      const qn = norm(q);
      out = out.filter(
        (r) =>
          norm(r.nombre).includes(qn) ||
          norm(r.tipoMaquinariaNombre).includes(qn),
      );
    }
    return out;
  }, [rows, tipoFilter, search]);

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
          canManage ? (
            <Button asChild>
              <Link href="/mantenimiento/plantillas/nueva">
                <Plus className="size-4" />
                {tP("nueva")}
              </Link>
            </Button>
          ) : null
        }
      />

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tP("buscarPlaceholder")}
        />
        <Toolbar.Selects>
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
        </Toolbar.Selects>
      </Toolbar>

      <DataTable<PlantillaRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "nombre", desc: false }]}
        onRowClick={(row) =>
          router.push(`/mantenimiento/plantillas/${row.id}`)
        }
        emptyState={tP("vacio")}
      />
    </div>
  );
}
