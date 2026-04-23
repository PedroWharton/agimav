"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, AlertCircle, CalendarClock, Wrench, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/stats/kpi-card";
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
import { Toolbar } from "@/components/app/toolbar";
import { EmptyState } from "@/components/app/states";
import { Combobox } from "@/components/app/combobox";
import { KanbanCard } from "@/components/mantenimiento/kanban-card";
import { MantEstadoChip } from "@/components/mantenimiento/estado-chip";
import { cn } from "@/lib/utils";
import {
  MANT_ESTADOS,
  MANT_ESTADO_I18N_KEY,
  MANT_ESTADOS_TERMINALES,
} from "@/lib/mantenimiento/estado";

export type MantenimientoRow = {
  id: number;
  tipo: string;
  estado: string;
  prioridad: string | null;
  maquinaria: string;
  maquinariaId: number;
  responsable: string;
  responsableId: number;
  fechaCreacion: string;
  fechaProgramada: string | null;
  fechaInicio: string | null;
  fechaFinalizacion: string | null;
  diasAbiertos: number;
  tareasTotal: number;
  tareasRealizadas: number;
};

const ALL = "__all__";

type ViewMode = "lista" | "tablero";

type LaneDef = {
  key: string;
  estado: string;
  tone: "info" | "warn";
};

const LANES: LaneDef[] = [
  { key: "pendiente", estado: "Pendiente", tone: "info" },
  { key: "chacra", estado: "En Reparación - Chacra", tone: "warn" },
  { key: "taller", estado: "En Reparación - Taller", tone: "warn" },
];

const LANE_HEADER_TONE: Record<LaneDef["tone"], string> = {
  info: "text-info",
  warn: "text-warn",
};

const LANE_COUNTER_TONE: Record<LaneDef["tone"], string> = {
  info: "bg-info-weak text-info",
  warn: "bg-warn-weak text-warn",
};

function normalizeView(raw: string | null): ViewMode {
  return raw === "tablero" ? "tablero" : "lista";
}

export type MantenimientoKpis = {
  activos: number;
  vencidas: number;
  proximas: number;
  enCurso: number;
  pendientes: number;
};

export function MantenimientosClient({
  rows,
  responsables,
  kpis,
}: {
  rows: MantenimientoRow[];
  responsables: { id: number; nombre: string }[];
  kpis: MantenimientoKpis;
}) {
  const t = useTranslations();
  const tM = useTranslations("mantenimiento");
  const tLista = useTranslations("mantenimiento.lista");
  const tTablero = useTranslations("mantenimiento.tablero");
  const tEstados = useTranslations("mantenimiento.estados");
  const tTipos = useTranslations("mantenimiento.tipos");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: ViewMode = normalizeView(viewParam);

  const setView = useCallback(
    (next: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "lista") {
        params.delete("view");
      } else {
        params.set("view", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState(ALL);
  const [tipoFilter, setTipoFilter] = useState<string>("correctivo");
  const [responsableFilter, setResponsableFilter] = useState(ALL);
  const [includeCerrados, setIncludeCerrados] = useState(false);

  const filteredBase = useMemo(() => {
    const needle = query
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    return rows.filter((r) => {
      if (tipoFilter !== ALL && r.tipo !== tipoFilter) return false;
      if (
        responsableFilter !== ALL &&
        String(r.responsableId) !== responsableFilter
      ) {
        return false;
      }
      if (needle) {
        const hay = `${r.id} ${r.maquinaria} ${r.responsable}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, tipoFilter, responsableFilter, query]);

  // List view also honors estadoFilter + includeCerrados.
  const filteredList = useMemo(() => {
    return filteredBase.filter((r) => {
      if (
        !includeCerrados &&
        estadoFilter === ALL &&
        (MANT_ESTADOS_TERMINALES as readonly string[]).includes(r.estado)
      ) {
        return false;
      }
      if (estadoFilter !== ALL && r.estado !== estadoFilter) return false;
      return true;
    });
  }, [filteredBase, estadoFilter, includeCerrados]);

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

  const toolbar = (
    <Toolbar>
      <Toolbar.Search
        value={query}
        onValueChange={setQuery}
        placeholder={tM("index.buscarPlaceholder")}
      />
      <Toolbar.Selects>
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

        {view === "lista" ? (
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
        ) : null}

        {view === "lista" ? (
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
        ) : null}
      </Toolbar.Selects>
      <Toolbar.ViewMode<ViewMode>
        value={view}
        onValueChange={setView}
        options={[
          {
            value: "lista",
            label: tLista("vista"),
            icon: <ListIcon />,
          },
          {
            value: "tablero",
            label: tTablero("vista"),
            icon: <BoardIcon />,
          },
        ]}
      />
    </Toolbar>
  );

  const richDescription = tM("index.descripcionRica", {
    activos: kpis.activos,
    vencidas: kpis.vencidas,
    enTaller: kpis.enCurso,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tM("index.titulo")}
        description={richDescription}
        actions={
          <Button asChild>
            <Link href="/mantenimiento/nuevo">
              <Plus className="size-4" />
              {tM("index.nuevo")}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={AlertCircle}
          tone={kpis.vencidas > 0 ? "danger" : "neutral"}
          label={tM("kpis.vencidas")}
          value={kpis.vencidas.toLocaleString("es-AR")}
          caption={tM("kpis.vencidasCaption", { count: kpis.vencidas })}
        />
        <KpiCard
          icon={CalendarClock}
          tone={kpis.proximas > 0 ? "warn" : "neutral"}
          label={tM("kpis.proximas")}
          value={kpis.proximas.toLocaleString("es-AR")}
          caption={tM("kpis.proximasCaption")}
        />
        <KpiCard
          icon={Wrench}
          tone={kpis.enCurso > 0 ? "info" : "neutral"}
          label={tM("kpis.enCurso")}
          value={kpis.enCurso.toLocaleString("es-AR")}
          caption={tM("kpis.enCursoCaption")}
        />
        <KpiCard
          icon={Clock}
          tone="neutral"
          label={tM("kpis.pendientes")}
          value={kpis.pendientes.toLocaleString("es-AR")}
          caption={tM("kpis.pendientesCaption")}
        />
      </div>

      {toolbar}

      {view === "tablero" ? (
        <KanbanBoard
          rows={filteredBase}
          emptyLabel={tTablero("laneVacia")}
          tEstados={tEstados}
        />
      ) : (
        <DataTable<MantenimientoRow>
          columns={columns}
          data={filteredList}
          searchPlaceholder={tM("index.buscarPlaceholder")}
          initialSort={[{ id: "id", desc: true }]}
          onRowClick={(row) => router.push(`/mantenimiento/${row.id}`)}
          filterSlot={
            <span className="text-sm text-muted-foreground">
              {tM("index.resultadosCount", { count: filteredList.length })}
            </span>
          }
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                variant="no-data"
                title={tM("avisos.vacio")}
                description=""
              />
            ) : (
              t("listados.common.sinResultadosFiltrados")
            )
          }
        />
      )}
    </div>
  );
}

function KanbanBoard({
  rows,
  emptyLabel,
  tEstados,
}: {
  rows: MantenimientoRow[];
  emptyLabel: string;
  tEstados: (key: string) => string;
}) {
  const byLane = useMemo(() => {
    const map: Record<string, MantenimientoRow[]> = {};
    for (const lane of LANES) map[lane.key] = [];
    for (const row of rows) {
      const lane = LANES.find((l) => l.estado === row.estado);
      if (lane) map[lane.key].push(row);
    }
    return map;
  }, [rows]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {LANES.map((lane) => {
        const items = byLane[lane.key] ?? [];
        const label = tEstados(
          MANT_ESTADO_I18N_KEY[lane.estado as keyof typeof MANT_ESTADO_I18N_KEY],
        );
        return (
          <section
            key={lane.key}
            className="flex min-h-[320px] flex-col gap-2 rounded-xl bg-muted p-2.5"
            aria-label={label}
          >
            <header
              className={cn(
                "flex items-center gap-1.5 px-1 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider",
                LANE_HEADER_TONE[lane.tone],
              )}
            >
              <span className="flex-1 truncate">{label}</span>
              <span
                className={cn(
                  "inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                  LANE_COUNTER_TONE[lane.tone],
                )}
              >
                {items.length}
              </span>
            </header>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-6 text-center text-xs text-muted-foreground">
                  {emptyLabel}
                </div>
              ) : (
                items.map((row) => (
                  <KanbanCard
                    key={row.id}
                    id={row.id}
                    tipo={row.tipo}
                    maquinaria={row.maquinaria}
                    responsable={row.responsable}
                    prioridad={row.prioridad}
                    dueDate={row.fechaProgramada ?? row.fechaInicio}
                    tareasTotal={row.tareasTotal}
                    tareasRealizadas={row.tareasRealizadas}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <path d="M3 9h18M3 15h18" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={3} y={4} width={6} height={16} rx={1} />
      <rect x={10} y={4} width={6} height={10} rx={1} />
      <rect x={17} y={4} width={4} height={13} rx={1} />
    </svg>
  );
}
