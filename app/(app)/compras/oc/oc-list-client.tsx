"use client";

import { useMemo, useState } from "react";
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
import { Combobox } from "@/components/app/combobox";
import { Toolbar } from "@/components/app/toolbar";
import { OcStatus } from "@/components/compras/oc-status";
import { OcDetailDrawer } from "@/components/compras/oc-detail-drawer";
import { OC_ESTADOS } from "@/lib/compras/oc-estado";

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

export function OcListClient({
  rows,
  proveedores,
}: {
  rows: OcRow[];
  proveedores: string[];
}) {
  const tOc = useTranslations("compras.oc");
  const tEstados = useTranslations("compras.common.estados");

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>(ESTADO_ALL);
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);
  const [drawerOcId, setDrawerOcId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (estadoFilter !== ESTADO_ALL && r.estado !== estadoFilter)
        return false;
      if (provFilter !== PROV_ALL && r.proveedor !== provFilter) return false;
      if (q) {
        const hay =
          (r.numeroOc ?? "").toLowerCase().includes(q) ||
          r.proveedor.toLowerCase().includes(q) ||
          (r.comprador ?? "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, search, estadoFilter, provFilter]);

  const columns: ColumnDef<OcRow>[] = [
    {
      accessorKey: "numeroOc",
      header: tOc("campos.numero"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">
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
      cell: ({ row }) => (
        <OcStatus estado={row.original.estado} showProgress={false} />
      ),
    },
  ];

  function handleRowClick(row: OcRow) {
    setDrawerOcId(row.id);
    setDrawerOpen(true);
  }

  function handleDrawerOpenChange(next: boolean) {
    setDrawerOpen(next);
    if (!next) {
      // Keep id briefly so content doesn't flash out during close animation.
      setTimeout(() => setDrawerOcId(null), 200);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tOc("buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Select
            value={estadoFilter}
            onValueChange={(v) => setEstadoFilter(v || ESTADO_ALL)}
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder={tOc("filtros.estado")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ESTADO_ALL}>{tOc("filtros.todos")}</SelectItem>
              {OC_ESTADOS.map((e) => (
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
            className="h-9 w-[220px]"
          />
        </Toolbar.Selects>
      </Toolbar>

      <DataTable<OcRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "numeroOc", desc: true }]}
        onRowClick={handleRowClick}
        emptyState={
          rows.length === 0 ? tOc("avisos.vacio") : tOc("avisos.vacioFiltrado")
        }
      />

      <OcDetailDrawer
        ocId={drawerOcId}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
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
