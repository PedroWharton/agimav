"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  PackageCheck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EstadoChip } from "@/components/compras/estado-chip";

import { cancelarOC } from "../actions";

export type OcDetailLinea = {
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadSolicitada: number;
  cantidadRecibida: number;
  precioUnitario: number;
  total: number;
};

export type OcDetailRecepcion = {
  id: number;
  numeroRemito: string;
  fechaRecepcion: string;
  cerradaSinFactura: boolean;
};

export type OcDetailData = {
  id: number;
  numeroOc: string | null;
  fechaEmision: string;
  estado: string;
  comprador: string | null;
  observaciones: string | null;
  totalEstimado: number;
  fechaCancelacion: string | null;
  canceladoPor: string | null;
  proveedor: {
    nombre: string;
    cuit: string | null;
    condicionIva: string | null;
    direccionFiscal: string | null;
  };
  solicitud: {
    id: number;
    solicitante: string;
    unidadProductiva: string;
  } | null;
  recepciones: OcDetailRecepcion[];
  detalle: OcDetailLinea[];
};

function formatCurrency(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function OcDetailClient({
  data,
  canCancel,
  hasRecepciones,
  canRecibir,
}: {
  data: OcDetailData;
  canCancel: boolean;
  hasRecepciones: boolean;
  canRecibir: boolean;
}) {
  const tOc = useTranslations("compras.oc");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();

  const [isCanceling, startCancel] = useTransition();

  function handleCancel() {
    startCancel(async () => {
      const result = await cancelarOC(data.id);
      if (result.ok) {
        toast.success(tOc("avisos.canceladaExitoso"));
        router.refresh();
      } else if (result.error === "has_recepciones") {
        toast.error(tOc("avisos.tieneRecepciones"));
      } else if (result.error === "wrong_estado") {
        toast.error(tOc("avisos.yaNoEsEmitida"));
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  const subtotal = data.detalle.reduce((s, l) => s + l.total, 0);
  const totalSolicitada = data.detalle.reduce(
    (s, l) => s + l.cantidadSolicitada,
    0,
  );
  const totalRecibida = data.detalle.reduce(
    (s, l) => s + l.cantidadRecibida,
    0,
  );
  const pctRecibido =
    totalSolicitada > 0 ? (totalRecibida / totalSolicitada) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/compras/oc">
            <ArrowLeft className="size-4" />
            {tOc("volver")}
          </Link>
        </Button>
        <PageHeader
          title={data.numeroOc ?? `#${data.id}`}
          description={`${format(new Date(data.fechaEmision), "dd/MM/yyyy", {
            locale: es,
          })} · ${data.proveedor.nombre}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <EstadoChip estado={data.estado} />
              <Button asChild variant="outline">
                <a
                  href={`/compras/oc/${data.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-4" />
                  {tOc("acciones.descargarPdf")}
                </a>
              </Button>
              {canRecibir ? (
                <Button asChild>
                  <Link href={`/compras/recepciones/nueva?ocId=${data.id}`}>
                    <PackageCheck className="size-4" />
                    {tOc("acciones.recibir")}
                  </Link>
                </Button>
              ) : null}
              {canCancel ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isCanceling || hasRecepciones}
                      title={
                        hasRecepciones ? tOc("avisos.tieneRecepciones") : ""
                      }
                    >
                      <X className="size-4" />
                      {tOc("acciones.cancelar")}
                    </Button>
                  }
                  title={tOc("avisos.cancelarTitulo")}
                  description={tOc("avisos.cancelarDescripcion")}
                  confirmLabel={tOc("acciones.cancelar")}
                  destructive
                  onConfirm={handleCancel}
                />
              ) : null}
            </div>
          }
        />
      </div>

      {data.estado === "Cancelada" && data.fechaCancelacion ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
            <X className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-sm font-medium">
              {tOc("canceladaPor", {
                nombre: data.canceladoPor ?? "—",
                fecha: format(
                  new Date(data.fechaCancelacion),
                  "dd/MM/yyyy HH:mm",
                  { locale: es },
                ),
              })}
            </div>
            <div className="text-xs">
              {tOc("avisos.cancelarDescripcion")}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tOc("secciones.proveedor")}
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-base font-semibold">
                {data.proveedor.nombre}
              </span>
              {data.proveedor.cuit ? (
                <span className="font-mono text-xs text-muted-foreground">
                  CUIT {data.proveedor.cuit}
                </span>
              ) : null}
              {data.proveedor.condicionIva ? (
                <span className="text-xs text-muted-foreground">
                  {data.proveedor.condicionIva}
                </span>
              ) : null}
            </div>
            {data.proveedor.direccionFiscal ? (
              <div className="text-xs text-muted-foreground">
                {data.proveedor.direccionFiscal}
              </div>
            ) : null}
            {data.comprador ? (
              <div className="mt-1 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <User className="size-3.5" />
                <span>
                  {tOc("campos.comprador")}:{" "}
                  <span className="text-foreground">{data.comprador}</span>
                </span>
              </div>
            ) : null}
          </section>

          {data.observaciones ? (
            <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tOc("campos.observaciones")}
              </h2>
              <p className="whitespace-pre-wrap text-sm">
                {data.observaciones}
              </p>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tOc("secciones.lineas")}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {data.detalle.length}
              </span>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium w-10">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium">
                      {tOc("columnas.item")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium w-24">
                      {tOc("columnas.cantidad")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium w-28">
                      {tOc("columnas.precio")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium w-28">
                      {tOc("columnas.total")}
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium w-36">
                      {tOc("columnas.recibido")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.detalle.map((l, idx) => {
                    const pct =
                      l.cantidadSolicitada > 0
                        ? (l.cantidadRecibida / l.cantidadSolicitada) * 100
                        : 0;
                    const full = pct >= 99.99;
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {l.itemCodigo || "—"}
                            </span>
                            <span className="text-sm">
                              {l.itemDescripcion || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="text-sm font-medium tabular-nums">
                            {l.cantidadSolicitada}
                          </div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {l.unidadMedida ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm">
                          {l.precioUnitario > 0
                            ? formatCurrency(l.precioUnitario)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm font-medium">
                          {l.total > 0 ? formatCurrency(l.total) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs tabular-nums">
                                {l.cantidadRecibida} / {l.cantidadSolicitada}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium tabular-nums",
                                  full
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : pct > 0
                                      ? "text-sky-700 dark:text-sky-400"
                                      : "text-muted-foreground",
                                )}
                              >
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  full
                                    ? "bg-emerald-500"
                                    : pct > 0
                                      ? "bg-sky-500"
                                      : "bg-muted",
                                )}
                                style={{
                                  width: `${Math.min(100, Math.max(0, pct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <span className="text-xs text-muted-foreground">
                {tOc("subtotalEstimado")}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {subtotal > 0 ? `$ ${formatCurrency(subtotal)}` : "—"}
              </span>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 text-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tOc("secciones.resumen")}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(data.fechaEmision), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
            </div>
            {totalSolicitada > 0 ? (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    {tOc("secciones.avanceRecepcion")}
                  </span>
                  <span className="text-xs font-medium tabular-nums">
                    {pctRecibido.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pctRecibido >= 99.99
                        ? "bg-emerald-500"
                        : pctRecibido > 0
                          ? "bg-sky-500"
                          : "bg-muted",
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, pctRecibido))}%`,
                    }}
                  />
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {totalRecibida} / {totalSolicitada}
                </div>
              </div>
            ) : null}
          </div>

          {data.solicitud ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tOc("solicitudOrigen")}
              </div>
              <Link
                href={`/compras/solicitudes/${data.solicitud.id}`}
                className="group -mx-2 flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                <div className="flex flex-1 flex-col">
                  <span className="font-mono text-xs">
                    #{data.solicitud.id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {data.solicitud.solicitante} ·{" "}
                    {data.solicitud.unidadProductiva}
                  </span>
                </div>
                <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground" />
              </Link>
            </div>
          ) : null}

          {data.recepciones.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tOc("secciones.recepciones")}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data.recepciones.length}
                </span>
              </div>
              <ul className="-mx-2 flex flex-col">
                {data.recepciones.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/compras/recepciones/${r.id}`}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-mono text-xs">
                          {r.numeroRemito}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.fechaRecepcion), "dd/MM/yyyy", {
                            locale: es,
                          })}
                          {r.cerradaSinFactura ? (
                            <span className="ml-1.5 rounded-sm bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wide">
                              {tOc("secciones.cerradaSinFactura")}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
