import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isPañolero, userNameFromSession } from "@/lib/rbac";
import { formatOCNumber } from "@/lib/compras/oc-number";

import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";

import {
  RecepcionFormClient,
  type RecepcionFormLinea,
  type RecepcionFormOc,
} from "./recepcion-form-client";

export default async function NuevaRecepcionPage({
  searchParams,
}: {
  searchParams: Promise<{ ocId?: string; oc?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isPañolero(session)) redirect("/compras/recepciones");

  const tRec = await getTranslations("compras.recepciones");

  const { ocId: ocIdParam, oc: ocParam } = await searchParams;
  const rawOcId = ocIdParam ?? ocParam;
  const ocId = rawOcId ? Number.parseInt(rawOcId, 10) : NaN;

  if (!Number.isFinite(ocId)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          variant="no-data"
          title={tRec("avisos.sinOcSeleccionada")}
          description={tRec("avisos.sinOcSeleccionadaDesc")}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/compras/oc">{tRec("volverAOc")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const oc = await prisma.ordenCompra.findUnique({
    where: { id: ocId },
    include: {
      proveedor: { select: { nombre: true } },
      detalle: {
        orderBy: { id: "asc" },
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
  });
  if (!oc) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          variant="no-data"
          title={tRec("avisos.ocInexistente")}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/compras/oc">{tRec("volverAOc")}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (oc.estado !== "Emitida" && oc.estado !== "Parcialmente Recibida") {
    redirect(`/compras/oc/${ocId}`);
  }

  const lineas: RecepcionFormLinea[] = oc.detalle.map((d, idx) => ({
    id: d.id,
    orden: idx + 1,
    itemCodigo: d.requisicionDetalle.item.codigo ?? "",
    itemDescripcion: d.requisicionDetalle.item.descripcion ?? "",
    unidadMedida: d.requisicionDetalle.item.unidadMedida,
    cantidadSolicitada: d.cantidadSolicitada,
    cantidadRecibida: d.cantidadRecibida,
    precioUnitario: d.precioUnitario,
  }));

  const ocPayload: RecepcionFormOc = {
    id: oc.id,
    numeroOc: oc.numeroOc ?? formatOCNumber(oc.id),
    proveedor: oc.proveedor.nombre,
    fechaEmision: oc.fechaEmision.toISOString(),
  };

  return (
    <RecepcionFormClient
      oc={ocPayload}
      lineas={lineas}
      defaultRecibidoPor={userNameFromSession(session) ?? ""}
    />
  );
}
