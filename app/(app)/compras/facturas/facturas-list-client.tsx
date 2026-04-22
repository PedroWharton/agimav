"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import {
  FileSpreadsheet,
  CalendarDays,
  Coins,
  Building2,
} from "lucide-react";

import { DataTable } from "@/components/app/data-table";
import { Combobox } from "@/components/app/combobox";
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";
import { formatARS } from "@/lib/format";

export type FacturaRow = {
  id: number;
  numeroFactura: string;
  fechaFactura: string;
  proveedor: string;
  total: number;
  lineasCount: number;
};

export type FacturasKpis = {
  total: number;
  delMes: number;
  montoMes: number;
  proveedoresMes: number;
  monthStartIso: string;
};

const PROV_ALL = "__all__";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function FacturasListClient({
  rows,
  proveedores,
  kpis,
}: {
  rows: FacturaRow[];
  proveedores: string[];
  kpis: FacturasKpis;
}) {
  const tFac = useTranslations("compras.facturas");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);

  const filtered = useMemo(() => {
    const q = search.trim();
    const qn = q ? norm(q) : "";
    return rows.filter((r) => {
      if (provFilter !== PROV_ALL && r.proveedor !== provFilter) return false;
      if (qn) {
        const hay =
          norm(r.numeroFactura).includes(qn) ||
          norm(r.proveedor).includes(qn);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, provFilter, search]);

  const mesLabel = useMemo(() => {
    const d = new Date(kpis.monthStartIso);
    return d.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    });
  }, [kpis.monthStartIso]);

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
        <span className="tabular-nums">{formatARS(row.original.total)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={FileSpreadsheet}
          tone="neutral"
          label={tFac("kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={tFac("kpi.totalCaption")}
        />
        <KpiCard
          icon={CalendarDays}
          tone="neutral"
          label={tFac("kpi.delMes")}
          value={kpis.delMes.toLocaleString("es-AR")}
          caption={tFac("kpi.delMesCaption", {
            count: kpis.delMes,
            mes: mesLabel,
          })}
        />
        <KpiCard
          icon={Coins}
          tone="info"
          label={tFac("kpi.montoMes")}
          value={formatARS(kpis.montoMes)}
          caption={tFac("kpi.montoMesCaption", { mes: mesLabel })}
        />
        <KpiCard
          icon={Building2}
          tone="neutral"
          label={tFac("kpi.proveedoresMes")}
          value={kpis.proveedoresMes.toLocaleString("es-AR")}
          caption={tFac("kpi.proveedoresMesCaption", { mes: mesLabel })}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tFac("buscarPlaceholder")}
        />
        <Toolbar.Selects>
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
        </Toolbar.Selects>
      </Toolbar>

      <DataTable<FacturaRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "fechaFactura", desc: true }]}
        onRowClick={(row) => router.push(`/compras/facturas/${row.id}`)}
        emptyState={
          rows.length === 0
            ? tFac("avisos.vacio")
            : tFac("avisos.vacioFiltrado")
        }
      />
    </div>
  );
}
