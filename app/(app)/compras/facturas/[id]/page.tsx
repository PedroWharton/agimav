import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/db";
import { formatOCNumber } from "@/lib/compras/oc-number";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function FacturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      proveedor: {
        select: {
          nombre: true,
          cuit: true,
          condicionIva: true,
        },
      },
      detalle: {
        orderBy: { id: "asc" },
        include: {
          recepcionDetalle: {
            include: {
              recepcion: {
                select: { id: true, numeroRemito: true },
              },
              ocDetalle: {
                include: {
                  oc: { select: { id: true, numeroOc: true } },
                  requisicionDetalle: {
                    include: {
                      item: {
                        select: {
                          codigo: true,
                          descripcion: true,
                          unidadMedida: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!factura) notFound();

  const tFac = await getTranslations("compras.facturas");

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
          title={factura.numeroFactura}
          description={`${format(factura.fechaFactura, "dd/MM/yyyy", {
            locale: es,
          })} · ${factura.proveedor.nombre}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                {tFac("campos.proveedor")}
              </div>
              <div className="font-medium">{factura.proveedor.nombre}</div>
              {factura.proveedor.cuit ? (
                <div className="text-xs text-muted-foreground">
                  CUIT {factura.proveedor.cuit}
                </div>
              ) : null}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {tFac("campos.usuario")}
              </div>
              <div className="font-medium">{factura.usuario ?? "—"}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-10">#</th>
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
                  <th className="px-2 py-2 text-right font-medium w-24">
                    {tFac("columnas.precioUnit")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-16">
                    {tFac("columnas.descuento")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-24">
                    {tFac("columnas.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {factura.detalle.map((d, idx) => {
                  const item = d.recepcionDetalle.ocDetalle.requisicionDetalle.item;
                  const oc = d.recepcionDetalle.ocDetalle.oc;
                  const ocNumero = oc.numeroOc ?? formatOCNumber(oc.id);
                  return (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {d.recepcionDetalle.recepcion.numeroRemito}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        <Link
                          href={`/compras/oc/${oc.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {ocNumero}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {item.descripcion || "—"}
                        {item.codigo ? (
                          <div className="font-mono text-xs text-muted-foreground">
                            {item.codigo}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {d.recepcionDetalle.cantidadRecibida}
                        {item.unidadMedida ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {item.unidadMedida}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatARS(d.precioUnitario)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {d.descuentoComercialPorcentaje.toFixed(2)}%
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatARS(d.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col gap-2 rounded-md border border-border p-4 text-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.subtotal")}
            </span>
            <span className="tabular-nums">{formatARS(factura.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.descuentoComercial")}
            </span>
            <span className="tabular-nums">
              {formatARS(factura.descuentoComercial)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.descuentoFinanciero")}
            </span>
            <span className="tabular-nums">
              {formatARS(factura.descuentoFinanciero)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.recargo")}
            </span>
            <span className="tabular-nums">{formatARS(factura.recargo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.netoGravado")}
            </span>
            <span className="tabular-nums">
              {formatARS(factura.netoGravado)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.ivaPorcentaje")}
            </span>
            <span className="tabular-nums">
              {factura.ivaPorcentaje.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {tFac("totales.ivaMonto")}
            </span>
            <span className="tabular-nums">{formatARS(factura.ivaMonto)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2">
            <span className="font-semibold">{tFac("totales.total")}</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatARS(factura.total)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
