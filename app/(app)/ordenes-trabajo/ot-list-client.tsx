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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { formatOTNumber } from "@/lib/ot/ot-number";
import { OT_ESTADOS, OT_PRIORIDADES } from "./actions";

export type OtRow = {
  id: number;
  numeroOt: string | null;
  titulo: string;
  fechaCreacion: string;
  fechaFinalizacion: string | null;
  prioridad: string;
  estado: string;
  solicitante: string | null;
  solicitanteId: number | null;
  responsable: string | null;
  responsableId: number | null;
  localidad: string | null;
  unidadProductiva: string | null;
  insumosCount: number;
};

const ALL = "__all__";

export function OtListClient({
  rows,
  usuarios,
}: {
  rows: OtRow[];
  usuarios: { id: number; nombre: string }[];
}) {
  const tO = useTranslations("ordenesTrabajo");
  const router = useRouter();

  const [estadoFilter, setEstadoFilter] = useState<string>(ALL);
  const [prioridadFilter, setPrioridadFilter] = useState<string>(ALL);
  const [responsableFilter, setResponsableFilter] = useState<string>(ALL);
  const [includeCerradas, setIncludeCerradas] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!includeCerradas && (r.estado === "Cerrada" || r.estado === "Cancelada")) {
        return false;
      }
      if (estadoFilter !== ALL && r.estado !== estadoFilter) return false;
      if (prioridadFilter !== ALL && r.prioridad !== prioridadFilter) return false;
      if (
        responsableFilter !== ALL &&
        String(r.responsableId ?? "") !== responsableFilter
      ) {
        return false;
      }
      return true;
    });
  }, [rows, estadoFilter, prioridadFilter, responsableFilter, includeCerradas]);

  const columns: ColumnDef<OtRow>[] = [
    {
      accessorKey: "numeroOt",
      header: tO("columnas.numero"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.numeroOt ?? formatOTNumber(row.original.id)}
        </span>
      ),
    },
    {
      accessorKey: "titulo",
      header: tO("columnas.titulo"),
      enableSorting: true,
    },
    {
      accessorKey: "fechaCreacion",
      header: tO("columnas.fechaCreacion"),
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
      accessorKey: "responsable",
      header: tO("columnas.responsable"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.responsable ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: "prioridad",
      header: tO("columnas.prioridad"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.prioridad}
        </span>
      ),
    },
    {
      accessorKey: "estado",
      header: tO("columnas.estado"),
      enableSorting: true,
      cell: ({ row }) => <EstadoChip estado={row.original.estado} />,
    },
    {
      accessorKey: "insumosCount",
      header: tO("columnas.insumos"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.insumosCount}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tO("titulo")}
        description={tO("descripcion")}
        actions={
          <Button asChild>
            <Link href="/ordenes-trabajo/nuevo">
              <Plus className="size-4" />
              {tO("nueva")}
            </Link>
          </Button>
        }
      />

      <DataTable<OtRow>
        columns={columns}
        data={filtered}
        searchableKeys={["titulo", "numeroOt", "responsable", "solicitante"]}
        searchPlaceholder={tO("buscarPlaceholder")}
        initialSort={[{ id: "numeroOt", desc: true }]}
        onRowClick={(row) => router.push(`/ordenes-trabajo/${row.id}`)}
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder={tO("filtros.estado")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tO("filtros.todos")}</SelectItem>
                {OT_ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={prioridadFilter}
              onValueChange={setPrioridadFilter}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder={tO("filtros.prioridad")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tO("filtros.todos")}</SelectItem>
                {OT_PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Combobox
              value={responsableFilter === ALL ? "" : responsableFilter}
              onChange={(v) => setResponsableFilter(v || ALL)}
              options={[
                { value: "", label: tO("filtros.todos") },
                ...usuarios.map((u) => ({
                  value: String(u.id),
                  label: u.nombre,
                })),
              ]}
              placeholder={tO("filtros.responsable")}
              allowCreate={false}
              className="h-9 w-[200px]"
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-cerradas-ot"
                checked={includeCerradas}
                onCheckedChange={(v) => setIncludeCerradas(v === true)}
              />
              <Label
                htmlFor="incluir-cerradas-ot"
                className="text-sm font-normal"
              >
                {tO("filtros.incluirCerradas")}
              </Label>
            </div>

            <span className="text-sm text-muted-foreground">
              {tO("resultadosCount", { count: filtered.length })}
            </span>
          </div>
        }
        emptyState={tO("avisos.vacio")}
      />
    </div>
  );
}

function EstadoChip({ estado }: { estado: string }) {
  const variant = estado === "En Curso"
    ? "default"
    : estado === "Cerrada"
      ? "secondary"
      : "outline";
  return (
    <Badge variant={variant} className="text-xs">
      {estado}
    </Badge>
  );
}
