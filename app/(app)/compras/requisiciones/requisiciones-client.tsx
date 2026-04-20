"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  CalendarPlus,
} from "lucide-react";
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
import { Toolbar } from "@/components/app/toolbar";
import { KpiCard } from "@/components/stats/kpi-card";
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

export type RequisicionesKpis = {
  total: number;
  pendientes: number;
  aprobadasSinOc: number;
  delMes: number;
  monthStartIso: string;
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

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function RequisicionesClient({
  rows,
  unidadesProductivas,
  currentUserName,
  kpis,
}: {
  rows: RequisicionRow[];
  unidadesProductivas: string[];
  isAdmin: boolean;
  currentUserName: string | null;
  kpis: RequisicionesKpis;
}) {
  const t = useTranslations();
  const tReq = useTranslations("compras.requisiciones");
  const tEstados = useTranslations("compras.common.estados");
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>(ESTADO_ALL);
  const [upFilter, setUpFilter] = useState<string>(UP_ALL);
  const [includeRechazadas, setIncludeRechazadas] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim();
    const qn = q ? norm(q) : "";
    return rows.filter((r) => {
      if (!includeRechazadas && r.estado === "Rechazada") return false;
      if (estadoFilter !== ESTADO_ALL && r.estado !== estadoFilter)
        return false;
      if (upFilter !== UP_ALL && r.unidadProductiva !== upFilter) return false;
      if (qn) {
        const hay =
          norm(r.solicitante).includes(qn) ||
          norm(r.unidadProductiva).includes(qn) ||
          norm(r.localidad).includes(qn) ||
          norm(String(r.id)).includes(qn);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, estadoFilter, upFilter, includeRechazadas, search]);

  const mesLabel = useMemo(() => {
    const d = new Date(kpis.monthStartIso);
    return d.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    });
  }, [kpis.monthStartIso]);

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={FileText}
          tone="neutral"
          label={tReq("kpi.total")}
          value={kpis.total.toLocaleString("es-AR")}
          caption={tReq("kpi.totalCaption")}
        />
        <KpiCard
          icon={Clock}
          tone={kpis.pendientes > 0 ? "warn" : "neutral"}
          label={tReq("kpi.pendientes")}
          value={kpis.pendientes.toLocaleString("es-AR")}
          caption={tReq("kpi.pendientesCaption", { count: kpis.pendientes })}
        />
        <KpiCard
          icon={CheckCircle2}
          tone={kpis.aprobadasSinOc > 0 ? "info" : "neutral"}
          label={tReq("kpi.aprobadas")}
          value={kpis.aprobadasSinOc.toLocaleString("es-AR")}
          caption={tReq("kpi.aprobadasCaption")}
        />
        <KpiCard
          icon={CalendarPlus}
          tone="neutral"
          label={tReq("kpi.delMes")}
          value={kpis.delMes.toLocaleString("es-AR")}
          caption={tReq("kpi.delMesCaption", { mes: mesLabel })}
        />
      </div>

      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tReq("buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Select
            value={estadoFilter}
            onValueChange={(v) => setEstadoFilter(v || ESTADO_ALL)}
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder={tReq("filtros.estado")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ESTADO_ALL}>{tReq("filtros.todos")}</SelectItem>
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
        </Toolbar.Selects>
        <Toolbar.Pills>
          <label className="inline-flex items-center gap-2 text-sm">
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
          </label>
          {currentUserName ? null : (
            <span className="text-xs text-destructive">
              {t("listados.common.errorForbidden")}
            </span>
          )}
        </Toolbar.Pills>
      </Toolbar>

      <DataTable<RequisicionRow>
        columns={columns}
        data={filtered}
        initialSort={[{ id: "id", desc: true }]}
        onRowClick={(row) => router.push(`/compras/requisiciones/${row.id}`)}
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
