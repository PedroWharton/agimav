"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Flame, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  requisicionesCount: number;
  requisicionIds: number[];
  /** ISO — used to sort oldest-first. */
  oldestRequisicionAt: string;
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
        <Toolbar.Selects>
          <Select
            value={urgenciaFilter}
            onValueChange={(v) =>
              setUrgenciaFilter((v || "todas") as UrgenciaFilter)
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">
                {tOc("pendientes.filtros.todas")}
              </SelectItem>
              <SelectItem value="urgentes">
                {tOc("pendientes.filtros.urgentes")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Toolbar.Selects>
      </Toolbar>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {tOc("pendientes.bulk.seleccionados", { count: selected.size })}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {tOc("pendientes.bulk.asignarTodos")}
            </span>
            <Select
              value={bulkProveedor}
              onValueChange={applyBulkProveedor}
            >
              <SelectTrigger className="h-9 w-[260px]">
                <SelectValue
                  placeholder={tOc("pendientes.bulk.elegirProveedor")}
                />
              </SelectTrigger>
              <SelectContent>
                {proveedorOptions.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      {missingProveedor > 0 && selected.size > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {tOc("pendientes.avisos.faltanProveedores", {
            count: missingProveedor,
          })}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(v) => toggleAllVisible(!!v)}
                  aria-label={tOc("pendientes.columnas.seleccionarTodos")}
                />
              </th>
              <th className="px-2 py-2 text-left font-medium w-28">
                {tOc("pendientes.columnas.codigo")}
              </th>
              <th className="px-2 py-2 text-left font-medium">
                {tOc("pendientes.columnas.descripcion")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-24">
                {tOc("pendientes.columnas.cantidad")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-16">
                {tOc("pendientes.columnas.unidad")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-24">
                {tOc("pendientes.columnas.urgencia")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-40">
                {tOc("pendientes.columnas.requisiciones")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-[260px]">
                {tOc("pendientes.columnas.proveedor")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
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
                  className="border-t border-border hover:bg-muted/20"
                >
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={(v) => toggleRow(r.itemId, !!v)}
                      aria-label={tOc("pendientes.columnas.seleccionar")}
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {r.itemCodigo || "—"}
                  </td>
                  <td className="px-2 py-2">{r.itemDescripcion || "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {r.cantidadTotal}
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {r.unidadMedida ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    {r.urgente ? (
                      <Badge
                        variant="secondary"
                        className="border-transparent bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                      >
                        <Flame className="mr-1 size-3" />
                        {tOc("pendientes.urgente")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {tOc("pendientes.normal")}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className="text-xs text-muted-foreground">
                      {tOc("pendientes.columnas.requisicionesCount", {
                        count: r.requisicionesCount,
                      })}
                    </span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.requisicionIds.slice(0, 3).map((rid) => (
                        <Link
                          key={rid}
                          href={`/compras/requisiciones/${rid}`}
                          className="font-mono text-[11px] text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                        >
                          #{rid}
                        </Link>
                      ))}
                      {r.requisicionIds.length > 3 ? (
                        <span className="text-[11px] text-muted-foreground">
                          +{r.requisicionIds.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">
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
