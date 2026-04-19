import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { formatOCNumber } from "@/lib/compras/oc-number";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";

import { CerrarSinFacturaButton } from "./cerrar-sin-factura-button";

export default async function RecepcionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const rec = await prisma.recepcion.findUnique({
    where: { id },
    include: {
      oc: {
        select: {
          id: true,
          numeroOc: true,
          proveedor: { select: { nombre: true } },
        },
      },
      detalle: {
        orderBy: { id: "asc" },
        include: {
          ocDetalle: {
            include: {
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
  });
  if (!rec) notFound();

  const session = await auth();
  const admin = isAdmin(session);
  const tRec = await getTranslations("compras.recepciones");
  const numeroOc = rec.oc.numeroOc ?? formatOCNumber(rec.oc.id);
  const pendientes = rec.detalle.filter((d) => !d.facturado).length;
  const canCerrarSinFactura =
    admin && !rec.cerradaSinFactura && pendientes > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/compras/recepciones">
            <ArrowLeft className="size-4" />
            {tRec("volver")}
          </Link>
        </Button>
        <PageHeader
          title={tRec("detalleTitulo", { remito: rec.numeroRemito })}
          description={`${format(rec.fechaRecepcion, "dd/MM/yyyy", {
            locale: es,
          })} · ${rec.oc.proveedor.nombre}`}
          actions={
            canCerrarSinFactura ? (
              <CerrarSinFacturaButton recepcionId={rec.id} />
            ) : undefined
          }
        />
      </div>

      {rec.cerradaSinFactura ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="font-medium">{tRec("cerrarSinFactura.banner")}</div>
          <div className="mt-1 text-xs">
            {tRec("cerrarSinFactura.cerradaPor", {
              nombre: rec.cerradoPor ?? "—",
              fecha: rec.fechaCierre
                ? format(rec.fechaCierre, "dd/MM/yyyy HH:mm", { locale: es })
                : "—",
            })}
          </div>
          {rec.motivoCierre ? (
            <div className="mt-1 text-xs">
              <span className="font-medium">
                {tRec("cerrarSinFactura.motivoLabel")}:
              </span>{" "}
              <span className="whitespace-pre-wrap">{rec.motivoCierre}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                {tRec("campos.oc")}
              </div>
              <Link
                href={`/compras/oc/${rec.oc.id}`}
                className="font-mono text-sm underline-offset-2 hover:underline"
              >
                {numeroOc}
              </Link>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {tRec("campos.recibidoPor")}
              </div>
              <div className="font-medium">{rec.recibidoPor}</div>
            </div>
            {rec.observaciones ? (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">
                  {tRec("campos.observaciones")}
                </div>
                <div className="whitespace-pre-wrap">{rec.observaciones}</div>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-10">#</th>
                  <th className="px-2 py-2 text-left font-medium w-28">
                    {tRec("columnas.codigo")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {tRec("columnas.descripcion")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-24">
                    {tRec("columnas.cantidad")}
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-20">
                    {tRec("columnas.facturado")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rec.detalle.map((d, idx) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {d.ocDetalle.requisicionDetalle.item.codigo || "—"}
                    </td>
                    <td className="px-2 py-2">
                      {d.ocDetalle.requisicionDetalle.item.descripcion || "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {d.cantidadRecibida}
                      {d.ocDetalle.requisicionDetalle.item.unidadMedida ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {d.ocDetalle.requisicionDetalle.item.unidadMedida}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {d.facturado
                        ? tRec("facturadoSi")
                        : tRec("facturadoNo")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
