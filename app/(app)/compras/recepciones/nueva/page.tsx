import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isPañolero, userNameFromSession } from "@/lib/rbac";
import { formatOCNumber } from "@/lib/compras/oc-number";

import {
  RecepcionFormClient,
  type RecepcionFormLinea,
  type RecepcionFormOc,
} from "./recepcion-form-client";

export default async function NuevaRecepcionPage({
  searchParams,
}: {
  searchParams: Promise<{ ocId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isPañolero(session)) redirect("/compras/recepciones");

  const { ocId: ocIdParam } = await searchParams;
  const ocId = ocIdParam ? Number.parseInt(ocIdParam, 10) : NaN;
  if (!Number.isFinite(ocId)) notFound();

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
  if (!oc) notFound();
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
  };

  return (
    <RecepcionFormClient
      oc={ocPayload}
      lineas={lineas}
      defaultRecibidoPor={userNameFromSession(session) ?? ""}
    />
  );
}
