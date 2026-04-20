"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, FileText, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { DetailDrawer, type DetailDrawerTab } from "@/components/app/detail-drawer";
import { OcStatus } from "@/components/compras/oc-status";

import {
  fetchOcDrawerData,
  type OcDrawerData,
} from "@/app/(app)/compras/oc/drawer-actions";

type LoadState =
  | { status: "loaded"; data: OcDrawerData }
  | { status: "error" };

function fmtARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy", { locale: es });
}

export function OcDetailDrawer({
  ocId,
  open,
  onOpenChange,
}: {
  ocId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tOc = useTranslations("compras.oc");
  // Keep the loaded payload keyed by id so we can distinguish "stale for
  // current ocId" (still loading) from "fresh" (loaded/error).
  const [result, setResult] = useState<{ id: number; state: LoadState } | null>(
    null,
  );

  useEffect(() => {
    if (!open || ocId == null) return;
    let cancelled = false;
    fetchOcDrawerData(ocId)
      .then((data) => {
        if (cancelled) return;
        if (data) setResult({ id: ocId, state: { status: "loaded", data } });
        else setResult({ id: ocId, state: { status: "error" } });
      })
      .catch(() => {
        if (!cancelled) setResult({ id: ocId, state: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [ocId, open]);

  const currentState: LoadState | "loading" =
    ocId != null && result && result.id === ocId ? result.state : "loading";

  const loadedData =
    currentState !== "loading" && currentState.status === "loaded"
      ? currentState.data
      : null;

  const title = loadedData
    ? loadedData.numeroOc ?? `#${loadedData.id}`
    : ocId != null
      ? `#${ocId}`
      : "";

  const subtitle = loadedData ? (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-foreground">
        {loadedData.proveedor.nombre}
      </span>
      {loadedData.proveedor.cuit ? (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            CUIT {loadedData.proveedor.cuit}
          </span>
        </>
      ) : null}
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {fmtDate(loadedData.fechaEmision)}
      </span>
      <span className="ml-1">
        <OcStatus estado={loadedData.estado} showProgress={false} />
      </span>
    </div>
  ) : null;

  const tabs: DetailDrawerTab[] | undefined = loadedData
    ? buildTabs(loadedData, tOc)
    : undefined;

  const footer = loadedData ? <DrawerFooter id={loadedData.id} /> : null;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      tabs={tabs}
      footer={footer}
      width="lg"
    >
      {currentState === "loading" ? (
        <div className="text-sm text-muted-foreground">
          {tOc("avisos.cargandoDetalle")}
        </div>
      ) : currentState.status === "error" ? (
        <div className="text-sm text-destructive">
          {tOc("avisos.errorCargaDetalle")}
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function buildTabs(
  data: OcDrawerData,
  tOc: ReturnType<typeof useTranslations>,
): DetailDrawerTab[] {
  const subtotal = data.detalle.reduce((s, l) => s + l.total, 0);

  return [
    {
      id: "resumen",
      label: tOc("drawer.tabs.resumen"),
      content: (
        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-4">
            <div>
              <div className="text-xs text-muted-foreground">
                {tOc("campos.proveedor")}
              </div>
              <div className="font-medium">{data.proveedor.nombre}</div>
              {data.proveedor.cuit ? (
                <div className="text-xs text-muted-foreground">
                  CUIT {data.proveedor.cuit}
                </div>
              ) : null}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {tOc("campos.comprador")}
              </div>
              <div className="font-medium">{data.comprador ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {tOc("campos.fechaEmision")}
              </div>
              <div className="font-medium tabular-nums">
                {fmtDate(data.fechaEmision)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {tOc("campos.estado")}
              </div>
              <div className="mt-1">
                <OcStatus estado={data.estado} showProgress />
              </div>
            </div>
            {data.observaciones ? (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">
                  {tOc("campos.observaciones")}
                </div>
                <div className="whitespace-pre-wrap">{data.observaciones}</div>
              </div>
            ) : null}
          </div>
          <div className="flex items-end justify-end gap-6 px-1">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-muted-foreground">
                {tOc("campos.lineas")}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {data.detalle.length}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-muted-foreground">
                {tOc("subtotalEstimado")}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {subtotal > 0 ? fmtARS(subtotal) : "—"}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "lineas",
      label: `${tOc("drawer.tabs.lineas")} (${data.detalle.length})`,
      content: (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted-2 text-xs uppercase tracking-wide text-subtle-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium w-28">
                  {tOc("columnas.codigo")}
                </th>
                <th className="px-2 py-2 text-left font-medium">
                  {tOc("columnas.descripcion")}
                </th>
                <th className="px-2 py-2 text-right font-medium w-24">
                  {tOc("columnas.cantidad")}
                </th>
                <th className="px-2 py-2 text-right font-medium w-24">
                  {tOc("columnas.precio")}
                </th>
                <th className="px-2 py-2 text-right font-medium w-28">
                  {tOc("columnas.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.detalle.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-2 py-2 font-mono text-xs">
                    {l.itemCodigo || "—"}
                  </td>
                  <td className="px-2 py-2">{l.itemDescripcion || "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {l.cantidadSolicitada}
                    {l.unidadMedida ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {l.unidadMedida}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {l.precioUnitario > 0 ? fmtARS(l.precioUnitario) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">
                    {l.total > 0 ? fmtARS(l.total) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: "recepciones",
      label: `${tOc("drawer.tabs.recepciones")} (${data.recepciones.length})`,
      content:
        data.recepciones.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {tOc("avisos.sinRecepciones")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted-2 text-xs uppercase tracking-wide text-subtle-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-32">
                    {tOc("drawer.columnas.remito")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-24">
                    {tOc("drawer.columnas.fecha")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {tOc("drawer.columnas.recibidoPor")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-16">
                    {tOc("drawer.columnas.lineas")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recepciones.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-2 font-mono text-xs">
                      {r.numeroRemito}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">
                      {fmtDate(r.fechaRecepcion)}
                    </td>
                    <td className="px-2 py-2">{r.recibidoPor}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.lineasCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
    },
    {
      id: "facturas",
      label: `${tOc("drawer.tabs.facturas")} (${data.facturas.length})`,
      content:
        data.facturas.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {tOc("avisos.sinFacturas")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted-2 text-xs uppercase tracking-wide text-subtle-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-40">
                    {tOc("drawer.columnas.factura")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-28">
                    {tOc("drawer.columnas.fecha")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    {tOc("drawer.columnas.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.facturas.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-2 py-2 font-mono text-xs">
                      {f.numeroFactura}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">
                      {fmtDate(f.fechaFactura)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">
                      {fmtARS(f.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
    },
  ];
}

function DrawerFooter({ id }: { id: number }) {
  const tOc = useTranslations("compras.oc");
  const proximamente = tOc("drawer.proximamente");

  return (
    <TooltipProvider delayDuration={200}>
      <Button asChild variant="ghost" size="sm" className="mr-auto">
        <Link href={`/compras/oc/${id}`}>
          <ExternalLink className="size-4" />
          {tOc("drawer.verPaginaCompleta")}
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button type="button" variant="outline" size="sm" disabled>
              <PackagePlus className="size-4" />
              {tOc("drawer.registrarRecepcion")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{proximamente}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button type="button" size="sm" disabled>
              <FileText className="size-4" />
              {tOc("drawer.adjuntarFactura")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{proximamente}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
