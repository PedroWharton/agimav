"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { PageHeader } from "@/components/app/page-header";
import { Combobox } from "@/components/app/combobox";
import { PriceDiscrepancyBadge } from "@/components/compras/price-discrepancy-badge";

import { classifyPriceDiscrepancy } from "@/lib/compras/price-discrepancy";

import { createFactura } from "../actions";

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
  ocId: number;
  ocNumero: string;
  itemId: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  ocPrecioUnitario: number;
};

type LineState = {
  id: number;
  selected: boolean;
  precio: string;
  descuento: string;
};

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function FacturaFormClient({
  proveedores,
  initialProveedorId,
  lineas,
}: {
  proveedores: FacturaProveedorOption[];
  initialProveedorId: number | null;
  lineas: FacturaRecepcionLinea[];
}) {
  const tFac = useTranslations("compras.facturas");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();

  const [proveedorId, setProveedorId] = useState<string>(
    initialProveedorId != null ? String(initialProveedorId) : "",
  );
  const [numeroFactura, setNumeroFactura] = useState("");
  const [fechaFactura, setFechaFactura] = useState(todayISODate());
  const [descuentoComercial, setDescuentoComercial] = useState("0");
  const [descuentoFinanciero, setDescuentoFinanciero] = useState("0");
  const [recargo, setRecargo] = useState("0");
  const [ivaPorcentaje, setIvaPorcentaje] = useState("21");
  const [lineState, setLineState] = useState<LineState[]>(() =>
    lineas.map((l) => ({
      id: l.id,
      selected: false,
      precio: "",
      descuento: "0",
    })),
  );
  useEffect(() => {
    setLineState(
      lineas.map((l) => ({
        id: l.id,
        selected: false,
        precio: "",
        descuento: "0",
      })),
    );
  }, [lineas]);
  const [isSaving, startSave] = useTransition();

  const proveedorOptions = useMemo(
    () => proveedores.map((p) => ({ value: String(p.id), label: p.nombre })),
    [proveedores],
  );

  function updateLine(id: number, patch: Partial<LineState>) {
    setLineState((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function toggleAll(checked: boolean) {
    setLineState((prev) => prev.map((l) => ({ ...l, selected: checked })));
  }

  const selectedLines = lineState.filter((l) => l.selected);

  const lineComputed = useMemo(
    () =>
      lineState.map((l) => {
        const base = lineas.find((x) => x.id === l.id)!;
        const precio = Number(l.precio);
        const desc = Number(l.descuento);
        const priceValid = Number.isFinite(precio) && precio >= 0;
        const descValid = Number.isFinite(desc) && desc >= 0 && desc <= 100;
        const netPrice = priceValid && descValid ? precio * (1 - desc / 100) : 0;
        const lineTotal = netPrice * base.cantidad;
        return {
          ...l,
          base,
          priceValid,
          descValid,
          netPrice,
          lineTotal,
        };
      }),
    [lineState, lineas],
  );

  const subtotalAuto = useMemo(() => {
    return lineComputed
      .filter((l) => l.selected)
      .reduce((s, l) => s + l.lineTotal, 0);
  }, [lineComputed]);

  const descComercialN = Number(descuentoComercial) || 0;
  const descFinancieroN = Number(descuentoFinanciero) || 0;
  const recargoN = Number(recargo) || 0;
  const ivaPctN = Number(ivaPorcentaje) || 0;
  const netoGravado = Math.max(
    0,
    subtotalAuto - descComercialN - descFinancieroN + recargoN,
  );
  const ivaMonto = netoGravado * (ivaPctN / 100);
  const total = netoGravado + ivaMonto;

  const canSave =
    !isSaving &&
    proveedorId !== "" &&
    numeroFactura.trim().length > 0 &&
    selectedLines.length > 0 &&
    lineComputed.every(
      (l) => !l.selected || (l.priceValid && l.descValid && l.netPrice >= 0),
    );

  function handleSave() {
    startSave(async () => {
      const pid = Number(proveedorId);
      if (!Number.isFinite(pid)) return;
      const payload = {
        proveedorId: pid,
        numeroFactura: numeroFactura.trim(),
        fechaFactura: new Date(fechaFactura),
        subtotal: subtotalAuto,
        descuentoComercial: descComercialN,
        descuentoFinanciero: descFinancieroN,
        recargo: recargoN,
        netoGravado,
        ivaPorcentaje: ivaPctN,
        ivaMonto,
        total,
        lineas: lineComputed
          .filter((l) => l.selected)
          .map((l) => ({
            recepcionDetalleId: l.id,
            precioUnitario: Number(l.precio),
            descuentoComercialPorcentaje: Number(l.descuento) || 0,
          })),
      };
      const result = await createFactura(payload);
      if (result.ok) {
        toast.success(tFac("avisos.creadaExitoso", { numero: numeroFactura }));
        router.push(`/compras/facturas/${result.id}`);
        router.refresh();
      } else if (result.error === "duplicate_numero") {
        toast.error(tFac("avisos.duplicadoNumero"));
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

  const allSelected =
    lineas.length > 0 && selectedLines.length === lineas.length;

  return (
    <div className="flex flex-col gap-6 p-6">
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
          actions={
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              <Save className="size-4" />
              {tFac("acciones.guardar")}
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label>{tFac("campos.proveedor")}</Label>
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
        <div className="md:col-span-1">
          <Label htmlFor="numeroFactura">{tFac("campos.numero")}</Label>
          <Input
            id="numeroFactura"
            value={numeroFactura}
            onChange={(e) => setNumeroFactura(e.target.value)}
            placeholder="B-0001-00000042"
            disabled={isSaving}
          />
        </div>
        <div className="md:col-span-1">
          <Label htmlFor="fechaFactura">{tFac("campos.fecha")}</Label>
          <Input
            id="fechaFactura"
            type="date"
            value={fechaFactura}
            onChange={(e) => setFechaFactura(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      {proveedorId ? (
        lineas.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {tFac("avisos.sinPendientes")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(c) => toggleAll(!!c)}
                      aria-label={tFac("seleccionarTodas")}
                    />
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-24">
                    {tFac("columnas.remito")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-24">
                    {tFac("columnas.oc")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {tFac("columnas.descripcion")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-16">
                    {tFac("columnas.cantidad")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-28">
                    {tFac("columnas.precioUnit")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-16">
                    {tFac("columnas.descuento")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-24">
                    {tFac("columnas.discrepancia")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineComputed.map((l) => {
                  const disc = classifyPriceDiscrepancy(
                    l.base.ocPrecioUnitario,
                    Number(l.precio),
                  );
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-2 py-2 align-top">
                        <Checkbox
                          checked={l.selected}
                          onCheckedChange={(c) =>
                            updateLine(l.id, { selected: !!c })
                          }
                        />
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-xs">
                        {l.base.remito}
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-xs">
                        <Link
                          href={`/compras/oc/${l.base.ocId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {l.base.ocNumero}
                        </Link>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div>{l.base.itemDescripcion || "—"}</div>
                        {l.base.itemCodigo ? (
                          <div className="font-mono text-xs text-muted-foreground">
                            {l.base.itemCodigo}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums align-top">
                        {l.base.cantidad}
                        {l.base.unidadMedida ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {l.base.unidadMedida}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={l.precio}
                          onChange={(e) =>
                            updateLine(l.id, { precio: e.target.value })
                          }
                          disabled={isSaving}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={l.descuento}
                          onChange={(e) =>
                            updateLine(l.id, { descuento: e.target.value })
                          }
                          disabled={isSaving}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <PriceDiscrepancyBadge kind={disc} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          {tFac("avisos.seleccionarProveedor")}
        </div>
      )}

      <div className="ml-auto w-full max-w-sm rounded-md border border-border p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">{tFac("totales.subtotal")}</span>
          <span className="tabular-nums">{formatARS(subtotalAuto)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <Label className="text-muted-foreground">
            {tFac("totales.descuentoComercial")}
          </Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={descuentoComercial}
            onChange={(e) => setDescuentoComercial(e.target.value)}
            disabled={isSaving}
            className="h-8 w-32 text-right"
          />
        </div>
        <div className="flex items-center justify-between py-1">
          <Label className="text-muted-foreground">
            {tFac("totales.descuentoFinanciero")}
          </Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={descuentoFinanciero}
            onChange={(e) => setDescuentoFinanciero(e.target.value)}
            disabled={isSaving}
            className="h-8 w-32 text-right"
          />
        </div>
        <div className="flex items-center justify-between py-1">
          <Label className="text-muted-foreground">{tFac("totales.recargo")}</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={recargo}
            onChange={(e) => setRecargo(e.target.value)}
            disabled={isSaving}
            className="h-8 w-32 text-right"
          />
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">{tFac("totales.netoGravado")}</span>
          <span className="tabular-nums">{formatARS(netoGravado)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <Label className="text-muted-foreground">
            {tFac("totales.ivaPorcentaje")}
          </Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={ivaPorcentaje}
            onChange={(e) => setIvaPorcentaje(e.target.value)}
            disabled={isSaving}
            className="h-8 w-32 text-right"
          />
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">{tFac("totales.ivaMonto")}</span>
          <span className="tabular-nums">{formatARS(ivaMonto)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2">
          <span className="font-semibold">{tFac("totales.total")}</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatARS(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
