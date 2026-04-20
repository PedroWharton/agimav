"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PackageCheck,
  CalendarDays,
  FileClock,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Combobox } from "@/components/app/combobox";
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";

export type RecepcionRow = {
  id: number;
  numeroRemito: string;
  fechaRecepcion: string;
  recibidoPor: string;
  ocId: number;
  ocNumero: string;
  proveedor: string;
  lineasCount: number;
  cerradaSinFactura: boolean;
  algunaLineaSinFacturar: boolean;
};

export type RecepcionesKpis = {
  total: number;
  delMes: number;
  sinFacturar: number;
  cerradas: number;
  monthStartIso: string;
};

const PROV_ALL = "__all__";

type RecepcionEstadoFilter = "todos" | "sinFacturar" | "facturadas" | "cerradas";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function RecepcionesListClient({
  rows,
  proveedores,
  kpis,
}: {
  rows: RecepcionRow[];
  proveedores: string[];
  kpis: RecepcionesKpis;
}) {
  const tRec = useTranslations("compras.recepciones");
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);
  const [estadoFilter, setEstadoFilter] =
    useState<RecepcionEstadoFilter>("todos");

  const filtered = useMemo(() => {
    const q = search.trim();
    const qn = q ? norm(q) : "";
    return rows.filter((r) => {
      if (provFilter !== PROV_ALL && r.proveedor !== provFilter) return false;
      if (estadoFilter === "sinFacturar") {
        if (r.cerradaSinFactura || !r.algunaLineaSinFacturar) return false;
      } else if (estadoFilter === "facturadas") {
        if (r.cerradaSinFactura || r.algunaLineaSinFacturar) return false;
      } else if (estadoFilter === "cerradas") {
        if (!r.cerradaSinFactura) return false;
      }
      if (qn) {
        const hay =
          norm(r.numeroRemito).includes(qn) ||
          norm(r.proveedor).includes(qn) ||
          norm(r.recibidoPor).includes(qn) ||
          norm(r.ocNumero).includes(qn);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, provFilter, estadoFilter, search]);

  const mesLabel = useMemo(() => {
    const d = new Date(kpis.monthStartIso);
    return d.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    });
  }, [kpis.monthStartIso]);

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
    {
      id: "facturado",
      header: tRec("columnas.facturado"),
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        if (r.cerradaSinFactura) {
          return (
            <Badge
              variant="secondary"
              className="border-transparent bg-muted text-muted-foreground"
            >
              {tRec("cerrarSinFactura.accion")}
            </Badge>
          );
        }
        if (r.algunaLineaSinFacturar) {
          return (
            <Badge
              variant="secondary"
              className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {tRec("facturadoNo")}
            </Badge>
          );
        }
        return (
          <Badge
            variant="secondary"
            className="border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {tRec("facturadoSi")}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tRec("titulo")}
        description={tRec("descripcion")}
        actions={
          <Button asChild variant="outline">
            <Link href="/compras/oc">{tRec("nuevaDesdeOc")}</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={PackageCheck}
          tone="neutral"
          label={tRec("kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={tRec("kpi.totalCaption")}
        />
        <KpiCard
          icon={CalendarDays}
          tone="neutral"
          label={tRec("kpi.delMes")}
          value={kpis.delMes.toLocaleString("es-AR")}
          caption={tRec("kpi.delMesCaption", {
            count: kpis.delMes,
            mes: mesLabel,
          })}
        />
        <KpiCard
          icon={FileClock}
          tone={kpis.sinFacturar > 0 ? "warn" : "neutral"}
          label={tRec("kpi.sinFacturar")}
          value={kpis.sinFacturar.toLocaleString("es-AR")}
          caption={tRec("kpi.sinFacturarCaption")}
          href="/compras/facturas/nueva"
        />
        <KpiCard
          icon={XCircle}
          tone={kpis.cerradas > 0 ? "info" : "neutral"}
          label={tRec("kpi.cerradas")}
          value={kpis.cerradas.toLocaleString("es-AR")}
          caption={tRec("kpi.cerradasCaption")}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tRec("buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Select
            value={estadoFilter}
            onValueChange={(v) =>
              setEstadoFilter((v || "todos") as RecepcionEstadoFilter)
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={tRec("columnas.facturado")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{tRec("filtros.todos")}</SelectItem>
              <SelectItem value="sinFacturar">
                {tRec("facturadoNo")}
              </SelectItem>
              <SelectItem value="facturadas">{tRec("facturadoSi")}</SelectItem>
              <SelectItem value="cerradas">
                {tRec("cerrarSinFactura.accion")}
              </SelectItem>
            </SelectContent>
          </Select>
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
        </Toolbar.Selects>
      </Toolbar>

      <DataTable<RecepcionRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "fechaRecepcion", desc: true }]}
        onRowClick={(row) => router.push(`/compras/recepciones/${row.id}`)}
        emptyState={
          rows.length === 0
            ? tRec("avisos.vacio")
            : tRec("avisos.vacioFiltrado")
        }
      />
    </div>
  );
}
