"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Flame, Replace, Send, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Combobox } from "@/components/app/combobox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/states";
import { Toolbar } from "@/components/app/toolbar";
import { NumberInput } from "@/components/app/number-input";
import { CrearItemDialog } from "@/components/compras/crear-item-dialog";
import type { InventarioOption } from "@/components/compras/detalle-lines-editor";

import { cambiarItemPendiente, emitirOcsAgrupadas } from "./actions";

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
  /** Per-line notes from the source requisiciones (deduped). */
  notas: string[];
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

/** Moves the state stored under `from` to `to` (unless `to` already has state). */
function remapKey<T>(
  rec: Record<number, T>,
  from: number,
  to: number,
): Record<number, T> {
  if (!(from in rec)) return rec;
  const next = { ...rec };
  const value = next[from];
  delete next[from];
  if (!(to in next)) next[to] = value;
  return next;
}

export function OcPendientesClient({
  rows,
  proveedorOptions,
  inventarioOptions,
  canCreateInventario,
}: {
  rows: AggregatedItemRow[];
  proveedorOptions: ProveedorOption[];
  inventarioOptions: InventarioOption[];
  canCreateInventario?: boolean;
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
  const [cantidadByItem, setCantidadByItem] = useState<
    Record<number, number | "">
  >(() => {
    const init: Record<number, number | ""> = {};
    for (const r of rows) init[r.itemId] = r.cantidadTotal;
    return init;
  });
  const [precioByItem, setPrecioByItem] = useState<Record<number, number | "">>(
    () => {
      const init: Record<number, number | ""> = {};
      for (const r of rows) init[r.itemId] = "";
      return init;
    },
  );
  // Per-line nota for the OC. Sparse: rows without an entry fall back to the
  // requisición notes (deduped) so the prefill survives router.refresh().
  const [notaByItem, setNotaByItem] = useState<Record<number, string>>({});
  // Header observaciones for each OC about to be emitted (keyed by proveedor).
  const [obsByProveedor, setObsByProveedor] = useState<Record<number, string>>(
    {},
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkProveedor, setBulkProveedor] = useState<string>("");
  const [isEmitting, startEmit] = useTransition();

  const rowByItem = useMemo(() => {
    const m = new Map<number, AggregatedItemRow>();
    for (const r of rows) m.set(r.itemId, r);
    return m;
  }, [rows]);

  function notaPrefill(itemId: number): string {
    return rowByItem.get(itemId)?.notas.join(" · ") ?? "";
  }

  function notaValue(itemId: number): string {
    return notaByItem[itemId] ?? notaPrefill(itemId);
  }

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

  /**
   * After a line's item is substituted server-side, carry the per-line state
   * (proveedor/cantidad/precio/nota/selección) over to the new itemId so the
   * refreshed row keeps what the user already loaded.
   */
  function handleItemSwapped(oldItemId: number, newItemId: number) {
    setProveedorByItem((prev) => remapKey(prev, oldItemId, newItemId));
    setCantidadByItem((prev) => remapKey(prev, oldItemId, newItemId));
    setPrecioByItem((prev) => remapKey(prev, oldItemId, newItemId));
    setNotaByItem((prev) => remapKey(prev, oldItemId, newItemId));
    setSelected((prev) => {
      if (!prev.has(oldItemId)) return prev;
      const next = new Set(prev);
      next.delete(oldItemId);
      next.add(newItemId);
      return next;
    });
    router.refresh();
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
      .map((itemId) => {
        const cant = cantidadByItem[itemId];
        const precio = precioByItem[itemId];
        const nota = (
          notaByItem[itemId] ??
          rowByItem.get(itemId)?.notas.join(" · ") ??
          ""
        ).trim();
        return {
          itemId,
          proveedorId: proveedorByItem[itemId] ?? null,
          cantidad: typeof cant === "number" ? cant : null,
          // El precio es opcional al emitir la OC: un ítem sin precio se emite
          // en 0 y queda pendiente hasta que la factura cargue el costo real.
          precioUnitario: typeof precio === "number" ? precio : 0,
          nota: nota ? nota : undefined,
        };
      })
      .filter(
        (
          a,
        ): a is {
          itemId: number;
          proveedorId: number;
          cantidad: number;
          precioUnitario: number;
          nota: string | undefined;
        } =>
          a.proveedorId != null && a.cantidad != null && a.cantidad > 0,
      );
  }, [
    selected,
    proveedorByItem,
    cantidadByItem,
    precioByItem,
    notaByItem,
    rowByItem,
  ]);

  const missingProveedor =
    Array.from(selected).filter((id) => !proveedorByItem[id]).length;
  const missingCantidad = Array.from(selected).filter((id) => {
    const v = cantidadByItem[id];
    return typeof v !== "number" || v <= 0;
  }).length;
  const missingPrecio = Array.from(selected).filter((id) => {
    const v = precioByItem[id];
    return typeof v !== "number" || v < 0;
  }).length;

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
        observacionesPorProveedor: Array.from(ocsCountByProveedor.keys())
          .map((proveedorId) => ({
            proveedorId,
            observaciones: (obsByProveedor[proveedorId] ?? "").trim(),
          }))
          .filter((o) => o.observaciones.length > 0),
      });
      if (result.ok) {
        toast.success(
          tOc("pendientes.avisos.emitidoExitoso", {
            count: result.ocIds.length,
          }),
        );
        setSelected(new Set());
        setBulkProveedor("");
        setObsByProveedor({});
        setNotaByItem({});
        setPrecioByItem((prev) => {
          const next: Record<number, number | ""> = {};
          for (const k of Object.keys(prev)) next[Number(k)] = "";
          return next;
        });
        router.refresh();
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "item_drained") {
        toast.error(tOc("pendientes.avisos.itemDrained"));
        router.refresh();
      } else if (result.error === "cantidad_exceeds") {
        toast.error(tOc("pendientes.avisos.cantidadExcede"));
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
          {missingCantidad > 0 ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {tOc("pendientes.avisos.faltanCantidades", {
                count: missingCantidad,
              })}
            </span>
          ) : null}
          {missingPrecio > 0 ? (
            <span className="text-xs text-muted-foreground">
              {tOc("pendientes.avisos.faltanPrecios", {
                count: missingPrecio,
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
                    missingCantidad > 0 ||
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

      {selected.size > 0 && ocsCountByProveedor.size > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tOc("pendientes.observaciones.titulo")}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tOc("pendientes.observaciones.ayuda")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from(ocsCountByProveedor.keys()).map((pid) => (
              <div key={pid} className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`oc-obs-${pid}`}
                  className="text-xs font-medium"
                >
                  {proveedorById.get(pid) ?? `#${pid}`}
                </Label>
                <Textarea
                  id={`oc-obs-${pid}`}
                  rows={2}
                  value={obsByProveedor[pid] ?? ""}
                  onChange={(e) =>
                    setObsByProveedor((prev) => ({
                      ...prev,
                      [pid]: e.target.value,
                    }))
                  }
                  placeholder={tOc("pendientes.observaciones.placeholder")}
                  className="min-h-0 resize-y text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1280px] text-sm">
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
                {tOc("pendientes.columnas.cantidadSolicitada")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-44">
                {tOc("pendientes.columnas.cantidadCompra")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-36">
                {tOc("pendientes.columnas.precioUnitario")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-36">
                {tOc("pendientes.columnas.solicitudes")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-[260px]">
                {tOc("pendientes.columnas.proveedor")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-[220px]">
                {tOc("pendientes.columnas.nota")}
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
                      <CambiarItemDialog
                        row={r}
                        inventarioOptions={inventarioOptions}
                        canCreateInventario={canCreateInventario}
                        onSwapped={handleItemSwapped}
                      />
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
                  <td className="px-3 py-2 align-middle text-right">
                    <NumberInput
                      value={cantidadByItem[r.itemId] ?? ""}
                      onChange={(v) => {
                        const clamped =
                          typeof v === "number"
                            ? Math.min(Math.max(v, 1), r.cantidadTotal)
                            : "";
                        setCantidadByItem((prev) => ({
                          ...prev,
                          [r.itemId]: clamped,
                        }));
                      }}
                      min={1}
                      max={r.cantidadTotal}
                      step={1}
                      steppers
                      className="h-9 w-full tabular-nums"
                      aria-label={tOc("pendientes.columnas.cantidadCompra")}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-right">
                    <NumberInput
                      value={precioByItem[r.itemId] ?? ""}
                      onChange={(v) =>
                        setPrecioByItem((prev) => ({
                          ...prev,
                          [r.itemId]: typeof v === "number" ? v : "",
                        }))
                      }
                      min={0}
                      step={0.01}
                      className="h-9 w-full text-right tabular-nums"
                      aria-label={tOc("pendientes.columnas.precioUnitario")}
                    />
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
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-1.5">
                      <StickyNote className="size-3.5 shrink-0 text-muted-foreground" />
                      <Input
                        value={notaValue(r.itemId)}
                        onChange={(e) =>
                          setNotaByItem((prev) => ({
                            ...prev,
                            [r.itemId]: e.target.value,
                          }))
                        }
                        className="h-9"
                        aria-label={tOc("pendientes.columnas.nota")}
                      />
                    </div>
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

/**
 * Per-line item substitution for the pendientes tab. Lets the buyer point the
 * line to another inventory item (or to one created on the spot via
 * {@link CrearItemDialog}, mirroring the requisición editor pattern); the
 * server action re-points every pending requisición line of the row's item.
 */
function CambiarItemDialog({
  row,
  inventarioOptions,
  canCreateInventario,
  onSwapped,
}: {
  row: AggregatedItemRow;
  inventarioOptions: InventarioOption[];
  canCreateInventario?: boolean;
  onSwapped: (oldItemId: number, newItemId: number) => void;
}) {
  const tOc = useTranslations("compras.oc");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  // Items created inline via CrearItemDialog, merged on top of the server-fed
  // options so they're immediately pickable without a page reload.
  const [extraOptions, setExtraOptions] = useState<InventarioOption[]>([]);
  const [pending, startTransition] = useTransition();

  const comboOptions = useMemo(
    () =>
      [...inventarioOptions, ...extraOptions]
        .filter((opt) => opt.id !== row.itemId)
        .map((opt) => ({
          value: String(opt.id),
          label: opt.codigo
            ? `${opt.codigo} · ${opt.descripcion}`
            : opt.descripcion,
        })),
    [inventarioOptions, extraOptions, row.itemId],
  );

  function handleItemCreated(item: InventarioOption) {
    setExtraOptions((prev) =>
      prev.some((o) => o.id === item.id) ? prev : [...prev, item],
    );
    setValue(String(item.id));
  }

  function handleConfirm() {
    const nuevoItemId = Number(value);
    if (!Number.isInteger(nuevoItemId) || nuevoItemId <= 0) return;
    startTransition(async () => {
      const res = await cambiarItemPendiente({
        itemId: row.itemId,
        nuevoItemId,
      });
      if (res.ok) {
        toast.success(tOc("pendientes.cambiarItem.toastOk"));
        setOpen(false);
        setValue("");
        onSwapped(row.itemId, nuevoItemId);
      } else if (res.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (res.error === "item_drained") {
        toast.error(tOc("pendientes.avisos.itemDrained"));
        router.refresh();
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setValue("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          aria-label={tOc("pendientes.cambiarItem.accion")}
          title={tOc("pendientes.cambiarItem.accion")}
        >
          <Replace className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tOc("pendientes.cambiarItem.titulo")}</DialogTitle>
          <DialogDescription>
            {tOc("pendientes.cambiarItem.descripcion", {
              item:
                row.itemDescripcion || row.itemCodigo || `#${row.itemId}`,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Combobox
            value={value}
            onChange={setValue}
            options={comboOptions}
            placeholder={tOc("pendientes.cambiarItem.placeholder")}
            allowCreate={false}
          />
          {canCreateInventario ? (
            <div>
              <CrearItemDialog
                description={tOc("pendientes.crearItem.descripcion")}
                onCreated={handleItemCreated}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {tCommon("cancelar")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !value}
          >
            {pending
              ? tCommon("guardando")
              : tOc("pendientes.cambiarItem.confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
