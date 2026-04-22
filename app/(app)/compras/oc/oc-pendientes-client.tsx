"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Flame, Send } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { Combobox } from "@/components/app/combobox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/states";
import { Toolbar } from "@/components/app/toolbar";

import { emitirOcsAgrupadas } from "./actions";

export type AggregatedItemRow = {
  itemId: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadTotal: number;
  urgente: boolean;
  solicitudesCount: number;
  solicitudIds: number[];
  /** ISO — used to sort oldest-first. */
  oldestSolicitudAt: string;
  proveedorSugeridoId: number | null;
};

export type ProveedorOption = {
  id: number;
  nombre: string;
};

type UrgenciaFilter = "todas" | "urgentes";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function OcPendientesClient({
  rows,
  proveedorOptions,
}: {
  rows: AggregatedItemRow[];
  proveedorOptions: ProveedorOption[];
}) {
  const tOc = useTranslations("compras.oc");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [urgenciaFilter, setUrgenciaFilter] = useState<UrgenciaFilter>("todas");
  const [proveedorByItem, setProveedorByItem] = useState<
    Record<number, number | null>
  >(() => {
    const init: Record<number, number | null> = {};
    for (const r of rows) init[r.itemId] = r.proveedorSugeridoId;
    return init;
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkProveedor, setBulkProveedor] = useState<string>("");
  const [isEmitting, startEmit] = useTransition();

  const proveedorComboOptions = useMemo(
    () => proveedorOptions.map((p) => ({ value: String(p.id), label: p.nombre })),
    [proveedorOptions],
  );
  const proveedorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of proveedorOptions) m.set(p.id, p.nombre);
    return m;
  }, [proveedorOptions]);

  const filteredRows = useMemo(() => {
    const q = norm(search.trim());
    return rows.filter((r) => {
      if (urgenciaFilter === "urgentes" && !r.urgente) return false;
      if (q) {
        const hay =
          norm(r.itemCodigo).includes(q) ||
          norm(r.itemDescripcion).includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, search, urgenciaFilter]);

  const visibleIds = useMemo(
    () => new Set(filteredRows.map((r) => r.itemId)),
    [filteredRows],
  );

  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selected.has(r.itemId));

  function toggleRow(itemId: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of visibleIds) next.add(id);
      } else {
        for (const id of visibleIds) next.delete(id);
      }
      return next;
    });
  }

  function setProveedor(itemId: number, proveedorId: number | null) {
    setProveedorByItem((prev) => ({ ...prev, [itemId]: proveedorId }));
  }

  function applyBulkProveedor(value: string) {
    setBulkProveedor(value);
    if (!value) return;
    const pid = Number(value);
    if (!Number.isFinite(pid)) return;
    setProveedorByItem((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = pid;
      return next;
    });
  }

  const readyAsignaciones = useMemo(() => {
    return Array.from(selected)
      .map((itemId) => ({
        itemId,
        proveedorId: proveedorByItem[itemId] ?? null,
      }))
      .filter(
        (a): a is { itemId: number; proveedorId: number } =>
          a.proveedorId != null,
      );
  }, [selected, proveedorByItem]);

  const missingProveedor =
    Array.from(selected).filter((id) => !proveedorByItem[id]).length;

  const ocsCountByProveedor = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of readyAsignaciones) {
      m.set(a.proveedorId, (m.get(a.proveedorId) ?? 0) + 1);
    }
    return m;
  }, [readyAsignaciones]);

  function handleEmit() {
    startEmit(async () => {
      const result = await emitirOcsAgrupadas({
        asignaciones: readyAsignaciones,
      });
      if (result.ok) {
        toast.success(
          tOc("pendientes.avisos.emitidoExitoso", {
            count: result.ocIds.length,
          }),
        );
        setSelected(new Set());
        setBulkProveedor("");
        router.refresh();
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "item_drained") {
        toast.error(tOc("pendientes.avisos.itemDrained"));
        router.refresh();
      } else if (result.error === "nothing_selected") {
        toast.error(tOc("pendientes.avisos.nadaSeleccionado"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  const urgentesCount = useMemo(
    () => rows.filter((r) => r.urgente).length,
    [rows],
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title={tOc("pendientes.vacio.titulo")}
        description={tOc("pendientes.vacio.descripcion")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tOc("pendientes.buscarPlaceholder")}
        />
        <Toolbar.Pills>
          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="radiogroup"
            aria-label={tOc("pendientes.columnas.urgencia")}
          >
            {(["todas", "urgentes"] as const).map((v) => {
              const active = urgenciaFilter === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setUrgenciaFilter(v)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? v === "urgentes"
                        ? "bg-amber-500 text-white"
                        : "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "urgentes" ? <Flame className="size-3" /> : null}
                  {tOc(`pendientes.filtros.${v}`)}
                  {v === "urgentes" && urgentesCount > 0 ? (
                    <span
                      className={cn(
                        "ml-0.5 rounded-sm px-1 text-[10px] font-semibold tabular-nums",
                        active ? "bg-white/20" : "bg-muted",
                      )}
                    >
                      {urgentesCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Toolbar.Pills>
      </Toolbar>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-primary/5">
          <span className="text-sm font-medium">
            {tOc("pendientes.bulk.seleccionados", { count: selected.size })}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {tOc("pendientes.bulk.asignarTodos")}
            </span>
            <Combobox
              value={bulkProveedor}
              onChange={applyBulkProveedor}
              options={proveedorComboOptions}
              placeholder={tOc("pendientes.bulk.elegirProveedor")}
              allowCreate={false}
              className="h-9 w-[240px]"
            />
          </div>
          {missingProveedor > 0 ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {tOc("pendientes.avisos.faltanProveedores", {
                count: missingProveedor,
              })}
            </span>
          ) : null}
          <div className="ml-auto">
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    readyAsignaciones.length === 0 ||
                    missingProveedor > 0 ||
                    isEmitting
                  }
                >
                  <Send className="size-4" />
                  {tOc("pendientes.acciones.emitir")}
                </Button>
              }
              title={tOc("pendientes.avisos.emitirTitulo", {
                items: readyAsignaciones.length,
                proveedores: ocsCountByProveedor.size,
              })}
              description={Array.from(ocsCountByProveedor.entries())
                .map(([pid, count]) =>
                  tOc("pendientes.avisos.emitirLinea", {
                    proveedor: proveedorById.get(pid) ?? `#${pid}`,
                    count,
                  }),
                )
                .join(" · ")}
              confirmLabel={tOc("pendientes.acciones.emitir")}
              onConfirm={handleEmit}
            />
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(v) => toggleAllVisible(!!v)}
                  aria-label={tOc("pendientes.columnas.seleccionarTodos")}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                {tOc("pendientes.columnas.item")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-28">
                {tOc("pendientes.columnas.cantidadTotal")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-36">
                {tOc("pendientes.columnas.solicitudes")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-[260px]">
                {tOc("pendientes.columnas.proveedor")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {tOc("avisos.vacioFiltrado")}
                </td>
              </tr>
            ) : null}
            {filteredRows.map((r) => {
              const isSel = selected.has(r.itemId);
              const pid = proveedorByItem[r.itemId] ?? null;
              return (
                <tr
                  key={r.itemId}
                  className={cn(
                    "border-t border-border transition-colors",
                    isSel ? "bg-primary/5" : "hover:bg-muted/20",
                  )}
                >
                  <td className="px-3 py-2 align-middle">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={(v) => toggleRow(r.itemId, !!v)}
                      aria-label={tOc("pendientes.columnas.seleccionar")}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {r.itemCodigo || "—"}
                        </span>
                        <span className="truncate text-sm font-medium">
                          {r.itemDescripcion || "—"}
                        </span>
                      </div>
                      {r.urgente ? (
                        <Badge
                          variant="secondary"
                          className="shrink-0 border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        >
                          <Flame className="mr-1 size-3" />
                          {tOc("pendientes.urgente")}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle text-right">
                    <div className="text-base font-semibold tabular-nums">
                      {r.cantidadTotal}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {r.unidadMedida ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {r.solicitudesCount}
                      </span>
                      <div className="flex min-w-0 flex-wrap gap-1">
                        {r.solicitudIds.slice(0, 3).map((rid) => (
                          <Link
                            key={rid}
                            href={`/compras/solicitudes/${rid}`}
                            className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-sky-700 underline-offset-2 hover:bg-muted-2 hover:underline dark:text-sky-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            #{rid}
                          </Link>
                        ))}
                        {r.solicitudIds.length > 3 ? (
                          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            +{r.solicitudIds.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Combobox
                      value={pid != null ? String(pid) : ""}
                      onChange={(v) =>
                        setProveedor(r.itemId, v ? Number(v) : null)
                      }
                      options={proveedorComboOptions}
                      placeholder={tOc("pendientes.elegirProveedor")}
                      allowCreate={false}
                      className="h-9"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
