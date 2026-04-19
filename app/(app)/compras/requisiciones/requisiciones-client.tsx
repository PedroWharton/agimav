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
import { EstadoChip } from "@/components/compras/estado-chip";

export type RequisicionRow = {
  id: number;
  fechaCreacion: string;
  solicitante: string;
  unidadProductiva: string;
  localidad: string;
  prioridad: string;
  estado: string;
  creadoPor: string | null;
  lineasCount: number;
};

const ESTADO_ALL = "__all__";
const UP_ALL = "__all__";

const ESTADO_FILTER_OPTIONS = [
  "Borrador",
  "En Revisión",
  "Aprobada",
  "Asignado a Proveedor",
  "OC Emitida",
] as const;

export function RequisicionesClient({
  rows,
  unidadesProductivas,
  currentUserName,
}: {
  rows: RequisicionRow[];
  unidadesProductivas: string[];
  isAdmin: boolean;
  currentUserName: string | null;
}) {
  const t = useTranslations();
  const tReq = useTranslations("compras.requisiciones");
  const tEstados = useTranslations("compras.common.estados");
  const router = useRouter();

  const [estadoFilter, setEstadoFilter] = useState<string>(ESTADO_ALL);
  const [upFilter, setUpFilter] = useState<string>(UP_ALL);
  const [includeRechazadas, setIncludeRechazadas] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!includeRechazadas && r.estado === "Rechazada") return false;
      if (estadoFilter !== ESTADO_ALL && r.estado !== estadoFilter)
        return false;
      if (upFilter !== UP_ALL && r.unidadProductiva !== upFilter) return false;
      return true;
    });
  }, [rows, estadoFilter, upFilter, includeRechazadas]);

  const columns: ColumnDef<RequisicionRow>[] = [
    {
      accessorKey: "id",
      header: tReq("campos.numero"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">#{row.original.id}</span>
      ),
    },
    {
      accessorKey: "fechaCreacion",
      header: tReq("campos.fecha"),
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
      accessorKey: "solicitante",
      header: tReq("campos.solicitante"),
      enableSorting: true,
    },
    {
      accessorKey: "unidadProductiva",
      header: tReq("campos.unidadProductiva"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.unidadProductiva || (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "lineasCount",
      header: tReq("campos.lineas"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.lineasCount}</span>
      ),
    },
    {
      accessorKey: "estado",
      header: tReq("campos.estado"),
      enableSorting: true,
      cell: ({ row }) => <EstadoChip estado={row.original.estado} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tReq("titulo")}
        description={tReq("descripcion")}
        actions={
          <Button asChild>
            <Link href="/compras/requisiciones/nueva">
              <Plus className="size-4" />
              {tReq("nueva")}
            </Link>
          </Button>
        }
      />

      <DataTable<RequisicionRow>
        columns={columns}
        data={filtered}
        searchableKeys={["solicitante", "unidadProductiva", "localidad"]}
        searchPlaceholder={tReq("buscarPlaceholder")}
        initialSort={[{ id: "id", desc: true }]}
        onRowClick={(row) =>
          router.push(`/compras/requisiciones/${row.id}`)
        }
        filterSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={estadoFilter}
              onValueChange={(v) => setEstadoFilter(v || ESTADO_ALL)}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue
                  placeholder={tReq("filtros.estado")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ESTADO_ALL}>
                  {tReq("filtros.todos")}
                </SelectItem>
                {ESTADO_FILTER_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {tEstados(estadoKeyFor(e))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Combobox
              value={upFilter === UP_ALL ? "" : upFilter}
              onChange={(v) => setUpFilter(v || UP_ALL)}
              options={[
                { value: "", label: tReq("filtros.todos") },
                ...unidadesProductivas.map((u) => ({ value: u, label: u })),
              ]}
              placeholder={tReq("filtros.unidadProductiva")}
              allowCreate={false}
              className="h-9 w-[200px]"
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-rechazadas"
                checked={includeRechazadas}
                onCheckedChange={(v) => setIncludeRechazadas(v === true)}
              />
              <Label
                htmlFor="incluir-rechazadas"
                className="text-sm font-normal"
              >
                {tReq("filtros.incluirRechazadas")}
              </Label>
            </div>

            <span className="text-sm text-muted-foreground">
              {tReq("resultadosCount", { count: filtered.length })}
            </span>

            {currentUserName ? null : (
              <span className="text-xs text-destructive">
                {t("listados.common.errorForbidden")}
              </span>
            )}
          </div>
        }
        emptyState={
          rows.length === 0
            ? tReq("avisos.vacio")
            : tReq("avisos.vacioFiltrado")
        }
      />
    </div>
  );
}

function estadoKeyFor(estado: string): string {
  const map: Record<string, string> = {
    Borrador: "Borrador",
    "En Revisión": "EnRevision",
    Aprobada: "Aprobada",
    "Asignado a Proveedor": "AsignadoAProveedor",
    "OC Emitida": "OCEmitida",
    Rechazada: "Rechazada",
  };
  return map[estado] ?? estado;
}
