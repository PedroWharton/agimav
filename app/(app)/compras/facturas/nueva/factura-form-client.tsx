"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";

import {
  FacturaLinesTable,
  InvoiceHeader,
  MatchBanner,
  TotalsSidebar,
  type FacturaLine,
  type FacturaTipo,
  type MatchStatus,
} from "@/components/compras/factura";

import { createFactura } from "../actions";

/**
 * Page-level client for `/compras/facturas/nueva`.
 *
 * Responsibilities:
 * - Present the R6-03 factura primitives (header / match banner / lines /
 *   totals sidebar / footer).
 * - Pre-populate lines from the server: one line per unbilled
 *   `RecepcionDetalle` belonging to the chosen proveedor (and filtered to a
 *   specific OC when `?oc=` was passed).
 * - Call the existing `createFactura` server action without modifying its
 *   signature — payload maps factura-primitive state back to the legacy
 *   `{ recepcionDetalleId, precioUnitario, descuentoComercialPorcentaje }`
 *   shape expected by the transaction.
 *
 * Tipo C / X: factura IVA is not itemized on those tipos, so we hide the IVA
 * column + totals rows via the `showIva` prop on both primitives and treat
 * per-line IVA as 0 when building totals.
 */

export type FacturaProveedorOption = {
  id: number;
  nombre: string;
};

export type FacturaRecepcionLinea = {
  id: number;
  cantidad: number;
  remito: string;
  recepcionId: number;
  fechaRecepcion: string;
  ocDetalleId: number;
  ocId: number;
  ocNumero: string;
  itemId: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  ocPrecioUnitario: number;
};

export type OcLinkContext = {
  id: number;
  numero: string;
  total: number;
};

type LineState = {
  recepcionDetalleId: number;
  selected: boolean;
  precioUnitario: number;
  iva: number;
  descuentoPct: number;
};

const MATCH_TOLERANCE = 0.01;

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initialLineState(lines: FacturaRecepcionLinea[]): LineState[] {
  return lines.map((l) => ({
    recepcionDetalleId: l.id,
    selected: false,
    precioUnitario: l.ocPrecioUnitario,
    iva: 21,
    descuentoPct: 0,
  }));
}

export function FacturaFormClient({
  proveedores,
  initialProveedorId,
  lineas,
  ocContext,
}: {
  proveedores: FacturaProveedorOption[];
  initialProveedorId: number | null;
  lineas: FacturaRecepcionLinea[];
  ocContext: OcLinkContext | null;
}) {
  const tFac = useTranslations("compras.facturas");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();

  // ── Header state ────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<FacturaTipo>("A");
  const [puntoDeVenta, setPuntoDeVenta] = useState("");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(todayISODate());

  const [proveedorId, setProveedorId] = useState<string>(
    initialProveedorId != null ? String(initialProveedorId) : "",
  );

  const [notas, setNotas] = useState("");

  // ── Line state: one per server-provided unbilled recepción detalle ──────
  const lineasKey = useMemo(() => lineas.map((l) => l.id).join(","), [lineas]);
  const [lineState, setLineState] = useState<LineState[]>(() => {
    const base = initialLineState(lineas);
    // If OC context is present, auto-select all lines (they all belong to
    // the linked OC).
    return ocContext ? base.map((l) => ({ ...l, selected: true })) : base;
  });
  const [prevKey, setPrevKey] = useState(lineasKey);
  if (lineasKey !== prevKey) {
    setPrevKey(lineasKey);
    const base = initialLineState(lineas);
    setLineState(ocContext ? base.map((l) => ({ ...l, selected: true })) : base);
  }

  const [isSaving, startSave] = useTransition();

  // ── Derived ─────────────────────────────────────────────────────────────
  const proveedorOptions = useMemo(
    () => proveedores.map((p) => ({ value: String(p.id), label: p.nombre })),
    [proveedores],
  );

  const proveedorSelected = useMemo(() => {
    const pid = Number(proveedorId);
    if (!Number.isFinite(pid)) return null;
    return proveedores.find((p) => p.id === pid) ?? null;
  }, [proveedorId, proveedores]);

  const showIva = tipo === "A" || tipo === "B";

  // Map the compact LineState + static FacturaRecepcionLinea into the
  // FacturaLine shape expected by the primitive.
  const displayLines: FacturaLine[] = useMemo(() => {
    return lineState.map((ls) => {
      const base = lineas.find((x) => x.id === ls.recepcionDetalleId);
      if (!base) {
        return {
          id: String(ls.recepcionDetalleId),
          nombre: "—",
          cantidad: 0,
          precioUnitario: ls.precioUnitario,
          iva: showIva ? ls.iva : 0,
        };
      }
      return {
        id: String(base.id),
        ocDetalleId: base.ocDetalleId,
        ocNumero: base.ocNumero,
        sku: base.itemCodigo || undefined,
        nombre: base.itemDescripcion || `#${base.id}`,
        cantidad: base.cantidad,
        precioUnitario: ls.precioUnitario,
        iva: showIva ? ls.iva : 0,
        ocPrecioUnitario: base.ocPrecioUnitario,
        ocCantidad: base.cantidad,
      };
    });
  }, [lineState, lineas, showIva]);

  const selectedStateLines = useMemo(
    () => lineState.filter((l) => l.selected),
    [lineState],
  );

  // Subtotal / IVA breakdown / total computed over SELECTED lines only.
  const totals = useMemo(() => {
    let subtotalNeto = 0;
    const ivaMap: Record<number, number> = {};
    let ivaMontoTotal = 0;

    for (const ls of lineState) {
      if (!ls.selected) continue;
      const base = lineas.find((x) => x.id === ls.recepcionDetalleId);
      if (!base) continue;
      const netPrice = ls.precioUnitario * (1 - ls.descuentoPct / 100);
      const lineNeto = netPrice * base.cantidad;
      subtotalNeto += lineNeto;
      if (showIva) {
        const ivaMonto = lineNeto * (ls.iva / 100);
        ivaMap[ls.iva] = (ivaMap[ls.iva] ?? 0) + ivaMonto;
        ivaMontoTotal += ivaMonto;
      }
    }

    const total = subtotalNeto + ivaMontoTotal;
    return { subtotalNeto, ivaMap, ivaMontoTotal, total };
  }, [lineState, lineas, showIva]);

  // Match status derived from OC total vs factura total.
  const matchStatus: MatchStatus = useMemo(() => {
    if (!ocContext) return "no-oc";
    if (Math.abs(totals.total - ocContext.total) <= MATCH_TOLERANCE)
      return "match";
    return "mismatch";
  }, [ocContext, totals.total]);

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleLineChange(id: string, patch: Partial<FacturaLine>) {
    const numId = Number(id);
    setLineState((prev) =>
      prev.map((ls) => {
        if (ls.recepcionDetalleId !== numId) return ls;
        const next = { ...ls };
        if (typeof patch.precioUnitario === "number")
          next.precioUnitario = Math.max(0, patch.precioUnitario);
        if (typeof patch.iva === "number") next.iva = patch.iva;
        return next;
      }),
    );
  }

  // Cantidad is driven by the recepción (qty received) — we do NOT let the
  // user edit it here because the action recomputes line totals from
  // `cantidadRecibida`. The primitive still renders the input, so we ignore
  // cantidad changes via the patch flow above.

  function handleToggle(recepcionDetalleId: number, checked: boolean) {
    setLineState((prev) =>
      prev.map((l) =>
        l.recepcionDetalleId === recepcionDetalleId
          ? { ...l, selected: checked }
          : l,
      ),
    );
  }

  function handleToggleAll(checked: boolean) {
    setLineState((prev) => prev.map((l) => ({ ...l, selected: checked })));
  }

  function handleRemove(id: string) {
    const numId = Number(id);
    // "Remove" = deselect in this context; the row maps back to a concrete
    // recepción detalle and can't be deleted from the DB here.
    handleToggle(numId, false);
  }

  // No-op: the blank-slate path has no unlinked lines to add in the current
  // backend. `FacturaLinesTable` still requires the handler.
  function handleAddLine() {
    toast.info(tFac("avisos.sinPendientes"));
  }

  // ── Validation / missing fields ─────────────────────────────────────────
  const missing: string[] = [];
  if (proveedorId === "") missing.push(tFac("faltan.proveedor"));
  if (numero.trim().length === 0) missing.push(tFac("faltan.numero"));
  if (selectedStateLines.length === 0) missing.push(tFac("faltan.lineas"));
  if (
    selectedStateLines.length > 0 &&
    !selectedStateLines.every(
      (l) => Number.isFinite(l.precioUnitario) && l.precioUnitario >= 0,
    )
  ) {
    missing.push(tFac("faltan.precio"));
  }
  const canSave = !isSaving && missing.length === 0;

  // ── Submit ──────────────────────────────────────────────────────────────
  function handleSave() {
    startSave(async () => {
      const pid = Number(proveedorId);
      if (!Number.isFinite(pid)) return;

      // Compose the wire `numeroFactura` from tipo + pto de venta + nº.
      // Matches the legacy format users already recognize, e.g.
      // "A-0001-00041237". Fallback to raw numero if pto de venta blank.
      const composed = puntoDeVenta
        ? `${tipo}-${puntoDeVenta.trim()}-${numero.trim()}`
        : numero.trim();

      // Recompute a representative `ivaPorcentaje` for the legacy column
      // (schema stores a single pct). Use the highest iva present among the
      // selected lines, defaulting to 21 for tipo A/B with no IVA set and 0
      // for tipo C/X.
      const presentRates = selectedStateLines
        .map((l) => l.iva)
        .filter((r) => r > 0);
      const ivaPorcentaje = showIva
        ? presentRates.length > 0
          ? Math.max(...presentRates)
          : 21
        : 0;

      const payload = {
        proveedorId: pid,
        numeroFactura: composed,
        fechaFactura: new Date(fecha),
        subtotal: totals.subtotalNeto,
        descuentoComercial: 0,
        descuentoFinanciero: 0,
        recargo: 0,
        netoGravado: totals.subtotalNeto,
        ivaPorcentaje,
        ivaMonto: totals.ivaMontoTotal,
        total: totals.total,
        lineas: selectedStateLines.map((l) => ({
          recepcionDetalleId: l.recepcionDetalleId,
          precioUnitario: l.precioUnitario,
          descuentoComercialPorcentaje: l.descuentoPct,
        })),
      };

      const result = await createFactura(payload);
      if (result.ok) {
        toast.success(tFac("avisos.creadaExitoso", { numero: composed }));
        router.push(`/compras/facturas/${result.id}`);
        router.refresh();
      } else if (result.error === "already_invoiced") {
        toast.error(tFac("avisos.yaFacturada"));
      } else if (result.error === "wrong_proveedor") {
        toast.error(tFac("avisos.proveedorInvalido"));
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const allSelected =
    lineState.length > 0 && lineState.every((l) => l.selected);
  const hasProveedor = proveedorId !== "";

  return (
    <div className="flex flex-col gap-6 p-6 pb-24">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/compras/facturas">
            <ArrowLeft className="size-4" />
            {tFac("volver")}
          </Link>
        </Button>
        <PageHeader
          title={tFac("nuevaTitulo")}
          description={tFac("nuevaDescripcion")}
        />
      </div>

      {/* Proveedor picker (shown until chosen; once chosen the chip appears
          inside the InvoiceHeader). */}
      {!hasProveedor ? (
        <Card size="sm" className="p-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="factura-proveedor">
              {tFac("campos.proveedor")} *
            </Label>
            <Combobox
              value={proveedorId}
              onChange={(v) => {
                setProveedorId(v);
                if (v) {
                  const url = new URL(window.location.href);
                  url.searchParams.set("proveedorId", v);
                  router.replace(`${url.pathname}?${url.searchParams}`);
                }
              }}
              options={proveedorOptions}
              placeholder={tFac("seleccionarProveedor")}
              allowCreate={false}
              className="h-10"
            />
          </div>
        </Card>
      ) : (
        <InvoiceHeader
          tipo={tipo}
          onTipoChange={setTipo}
          puntoDeVenta={puntoDeVenta}
          onPuntoDeVentaChange={setPuntoDeVenta}
          numero={numero}
          onNumeroChange={setNumero}
          fecha={fecha}
          onFechaChange={setFecha}
          proveedor={
            proveedorSelected ?? { id: Number(proveedorId), nombre: "—" }
          }
        />
      )}

      {hasProveedor ? (
        <>
          <MatchBanner
            status={matchStatus}
            ocNumero={ocContext?.numero}
            ocTotal={ocContext?.total}
            facturaTotal={totals.total}
          />

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-4">
              {lineas.length === 0 ? (
                <Card
                  size="sm"
                  className="p-5 text-sm text-muted-foreground"
                >
                  {tFac("avisos.sinPendientes")}
                </Card>
              ) : (
                <>
                  {/* Per-line selection — not part of the R6-03 primitive.
                      Render a lightweight row header with select-all above
                      the lines table. */}
                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <Checkbox
                      id="factura-select-all"
                      checked={allSelected}
                      onCheckedChange={(c) => handleToggleAll(!!c)}
                      aria-label={tFac("seleccionarTodas")}
                    />
                    <Label
                      htmlFor="factura-select-all"
                      className="cursor-pointer text-xs uppercase tracking-[0.06em] text-muted-foreground"
                    >
                      {tFac("seleccionarTodas")}
                    </Label>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedStateLines.length} / {lineState.length}
                    </span>
                  </div>

                  {/* Selection column, rendered as a compact table alongside
                      the lines. We keep checkboxes in a parallel table above
                      the primitive to avoid altering the primitive API. */}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1 rounded-lg bg-muted/20 px-3 py-2">
                      {lineState.map((ls) => {
                        const base = lineas.find(
                          (l) => l.id === ls.recepcionDetalleId,
                        );
                        if (!base) return null;
                        return (
                          <label
                            key={ls.recepcionDetalleId}
                            className="flex items-center gap-3 py-1 text-xs"
                          >
                            <Checkbox
                              checked={ls.selected}
                              onCheckedChange={(c) =>
                                handleToggle(ls.recepcionDetalleId, !!c)
                              }
                              aria-label={`${tFac("seleccionarTodas")} — ${base.itemDescripcion}`}
                            />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {base.remito}
                            </span>
                            <span className="truncate">
                              {base.itemDescripcion}
                            </span>
                            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                              {base.cantidad}
                              {base.unidadMedida
                                ? ` ${base.unidadMedida}`
                                : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <FacturaLinesTable
                    lines={displayLines}
                    onChange={handleLineChange}
                    onAdd={handleAddLine}
                    onRemove={handleRemove}
                    showIva={showIva}
                  />
                </>
              )}

              <Card size="sm" className="flex flex-col gap-2 p-4">
                <Label
                  htmlFor="factura-notas"
                  className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {tFac("campos.notas")}
                </Label>
                <Textarea
                  id="factura-notas"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder={tFac("campos.notasPlaceholder")}
                  rows={3}
                  disabled={isSaving}
                />
              </Card>
            </div>

            <aside className="lg:sticky lg:top-4">
              <TotalsSidebar
                subtotalNeto={totals.subtotalNeto}
                ivaPorAlicuota={totals.ivaMap}
                total={totals.total}
                ocTotal={ocContext?.total}
                showIva={showIva}
              />
            </aside>
          </div>
        </>
      ) : (
        <Card size="sm" className="p-4 text-sm text-muted-foreground">
          {tFac("avisos.seleccionarProveedor")}
        </Card>
      )}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          {!isSaving && missing.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {tFac("faltan.titulo")}: {missing.join(", ")}
            </p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/compras/facturas">
                {tFac("acciones.cancelar")}
              </Link>
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              <Save className="size-4" />
              {tFac("acciones.guardar")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
