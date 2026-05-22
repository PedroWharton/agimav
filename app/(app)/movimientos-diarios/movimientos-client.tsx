"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, NotebookPen, CalendarPlus, Hammer } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";
import { formatARS } from "@/lib/format";

export type MovimientoRow = {
  id: number;
  fecha: string;
  usuario: string | null;
  sector: string | null;
  localidad: string | null;
  lineas: number;
  herramientasPendientes: number;
  total: number;
};

export type MovimientosKpis = {
  total: number;
  nuevos30d: number;
  herramientasPendientes: number;
};

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function MovimientosClient({
  rows,
  canManage,
  kpis,
}: {
  rows: MovimientoRow[];
  canManage: boolean;
  kpis: MovimientosKpis;
}) {
  const t = useTranslations("movimientosDiarios");
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    const qn = norm(q);
    return rows.filter(
      (r) =>
        norm(r.usuario).includes(qn) ||
        norm(r.sector).includes(qn) ||
        norm(r.localidad).includes(qn),
    );
  }, [rows, search]);

  const columns: ColumnDef<MovimientoRow>[] = [
    {
      id: "fecha",
      header: t("columnas.fecha"),
      accessorFn: (row) => new Date(row.fecha).getTime(),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {format(new Date(row.original.fecha), "dd/MM/yyyy", { locale: es })}
        </span>
      ),
    },
    {
      accessorKey: "usuario",
      header: t("columnas.usuario"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.usuario ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "sector",
      header: t("columnas.sector"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.sector ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "lineas",
      header: t("columnas.lineas"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.lineas}
        </span>
      ),
    },
    {
      accessorKey: "herramientasPendientes",
      header: t("columnas.herramientas"),
      enableSorting: true,
      cell: ({ row }) =>
        row.original.herramientasPendientes > 0 ? (
          <Badge variant="secondary">
            {t("herramientasPendientes", {
              count: row.original.herramientasPendientes,
            })}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "total",
      header: t("columnas.total"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatARS(row.original.total)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("titulo")}
        description={t("descripcion")}
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/movimientos-diarios/nuevo">
                <Plus className="size-4" />
                {t("nuevo")}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          icon={NotebookPen}
          tone="neutral"
          label={t("kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={t("kpi.totalCaption")}
        />
        <KpiCard
          icon={CalendarPlus}
          tone="info"
          label={t("kpi.nuevos")}
          value={kpis.nuevos30d.toLocaleString("es-AR")}
          caption={t("kpi.nuevosCaption")}
        />
        <KpiCard
          icon={Hammer}
          tone={kpis.herramientasPendientes > 0 ? "warn" : "neutral"}
          label={t("kpi.herramientas")}
          value={kpis.herramientasPendientes.toLocaleString("es-AR")}
          caption={t("kpi.herramientasCaption")}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={t("buscarPlaceholder")}
        />
      </Toolbar>

      <DataTable<MovimientoRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "fecha", desc: true }]}
        onRowClick={(row) => router.push(`/movimientos-diarios/${row.id}`)}
        emptyState={
          search.trim()
            ? t("sinResultados")
            : canManage
              ? t("vacioAdmin")
              : t("vacio")
        }
      />
    </div>
  );
}
