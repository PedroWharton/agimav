"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MantEstadoChip } from "@/components/mantenimiento/estado-chip";
import {
  MANT_ESTADOS,
  MANT_ESTADO_I18N_KEY,
  MANT_ESTADOS_TERMINALES,
} from "@/lib/mantenimiento/estado";

export type MantenimientoRow = {
  id: number;
  tipo: string;
  estado: string;
  maquinaria: string;
  maquinariaId: number;
  responsable: string;
  responsableId: number;
  fechaCreacion: string;
  diasAbiertos: number;
};

const ALL = "__all__";

export function MantenimientosClient({
  rows,
  responsables,
}: {
  rows: MantenimientoRow[];
  responsables: { id: number; nombre: string }[];
}) {
  const t = useTranslations();
  const tM = useTranslations("mantenimiento");
  const tEstados = useTranslations("mantenimiento.estados");
  const tTipos = useTranslations("mantenimiento.tipos");
  const router = useRouter();

  const [estadoFilter, setEstadoFilter] = useState(ALL);
  const [tipoFilter, setTipoFilter] = useState<string>("correctivo");
  const [responsableFilter, setResponsableFilter] = useState(ALL);
  const [includeCerrados, setIncludeCerrados] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (
        !includeCerrados &&
        (MANT_ESTADOS_TERMINALES as readonly string[]).includes(r.estado)
      ) {
        return false;
      }
      if (estadoFilter !== ALL && r.estado !== estadoFilter) return false;
      if (tipoFilter !== ALL && r.tipo !== tipoFilter) return false;
      if (
        responsableFilter !== ALL &&
        String(r.responsableId) !== responsableFilter
      ) {
        return false;
      }
      return true;
    });
  }, [rows, estadoFilter, tipoFilter, responsableFilter, includeCerrados]);

  const columns: ColumnDef<MantenimientoRow>[] = [
    {
      accessorKey: "id",
      header: tM("columnas.numero"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">#{row.original.id}</span>
      ),
    },
    {
      accessorKey: "maquinaria",
      header: tM("campos.maquina"),
      enableSorting: true,
    },
    {
      accessorKey: "tipo",
      header: tM("campos.tipo"),
      enableSorting: true,
      cell: ({ row }) => {
        const k = row.original.tipo as "correctivo" | "preventivo";
        return (
          <span className="text-xs text-muted-foreground capitalize">
            {tTipos(k)}
          </span>
        );
      },
    },
    {
      accessorKey: "estado",
      header: tM("campos.estado"),
      enableSorting: true,
      cell: ({ row }) => <MantEstadoChip estado={row.original.estado} />,
    },
    {
      accessorKey: "responsable",
      header: tM("campos.responsable"),
      enableSorting: true,
    },
    {
      accessorKey: "fechaCreacion",
      header: tM("campos.fechaCreacion"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(new Date(row.original.fechaCreacion), "dd/MM/yyyy", {
            locale: es,
          })}
        </span>
      ),
    },
    {
      accessorKey: "diasAbiertos",
      header: tM("columnas.diasAbiertos"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.diasAbiertos}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tM("index.titulo")}
        description={tM("index.descripcion")}
        actions={
          <Button asChild>
            <Link href="/mantenimiento/nuevo">
              <Plus className="size-4" />
              {tM("index.nuevo")}
            </Link>
          </Button>
        }
      />

      <DataTable<MantenimientoRow>
        columns={columns}
        data={filtered}
        searchableKeys={["maquinaria", "responsable"]}
        searchPlaceholder={tM("index.buscarPlaceholder")}
        initialSort={[{ id: "id", desc: true }]}
        onRowClick={(row) => router.push(`/mantenimiento/${row.id}`)}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder={tM("filtros.tipo")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tM("filtros.todos")}</SelectItem>
                <SelectItem value="correctivo">{tTipos("correctivo")}</SelectItem>
                <SelectItem value="preventivo">{tTipos("preventivo")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder={tM("filtros.estado")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tM("filtros.todos")}</SelectItem>
                {MANT_ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {tEstados(MANT_ESTADO_I18N_KEY[e])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Combobox
              value={responsableFilter === ALL ? "" : responsableFilter}
              onChange={(v) => setResponsableFilter(v || ALL)}
              options={[
                { value: "", label: tM("filtros.todos") },
                ...responsables.map((r) => ({
                  value: String(r.id),
                  label: r.nombre,
                })),
              ]}
              placeholder={tM("filtros.responsable")}
              allowCreate={false}
              className="h-9 w-[200px]"
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-cerrados"
                checked={includeCerrados}
                onCheckedChange={(v) => setIncludeCerrados(v === true)}
              />
              <Label
                htmlFor="incluir-cerrados"
                className="text-sm font-normal"
              >
                {tM("filtros.incluirCerrados")}
              </Label>
            </div>

            <span className="text-sm text-muted-foreground">
              {tM("index.resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={
          rows.length === 0
            ? tM("avisos.vacio")
            : t("listados.common.sinResultados")
        }
      />
    </div>
  );
}
