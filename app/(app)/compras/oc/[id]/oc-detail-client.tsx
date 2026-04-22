"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Download, PackageCheck, X } from "lucide-react";
import { toast } from "sonner";

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
  detalle: OcDetailLinea[];
};

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm">
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
            {data.observaciones ? (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">
                  {tOc("campos.observaciones")}
                </div>
                <div className="whitespace-pre-wrap">{data.observaciones}</div>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-10">#</th>
                  <th className="px-2 py-2 text-left font-medium w-28">
                    {tOc("columnas.codigo")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {tOc("columnas.descripcion")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-20">
                    {tOc("columnas.cantidad")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-24">
                    {tOc("columnas.precio")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-28">
                    {tOc("columnas.total")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-24">
                    {tOc("columnas.recibido")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.detalle.map((l, idx) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </td>
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
                      {l.precioUnitario > 0
                        ? l.precioUnitario.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.total > 0
                        ? l.total.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.cantidadRecibida}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end text-sm">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">
                {tOc("subtotalEstimado")}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {subtotal > 0
                  ? subtotal.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3 rounded-md border border-border p-4 text-sm lg:sticky lg:top-4 lg:self-start">
          {data.solicitud ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tOc("solicitudOrigen")}
              </div>
              <Link
                href={`/compras/solicitudes/${data.solicitud.id}`}
                className="mt-1 block rounded-md px-2 py-1 hover:bg-muted/60"
              >
                <div className="font-mono text-xs">
                  #{data.solicitud.id}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.solicitud.solicitante} ·{" "}
                  {data.solicitud.unidadProductiva}
                </div>
              </Link>
            </div>
          ) : null}
          {data.fechaCancelacion && data.canceladoPor ? (
            <div className="text-xs text-destructive">
              {tOc("canceladaPor", {
                nombre: data.canceladoPor,
                fecha: format(
                  new Date(data.fechaCancelacion),
                  "dd/MM/yyyy HH:mm",
                  { locale: es },
                ),
              })}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
