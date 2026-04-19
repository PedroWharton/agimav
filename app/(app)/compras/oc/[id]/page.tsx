import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin, isPañolero } from "@/lib/rbac";

import { OcDetailClient, type OcDetailData } from "./oc-detail-client";

export default async function OcDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const admin = isAdmin(session);

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const oc = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: {
        select: {
          nombre: true,
          cuit: true,
          condicionIva: true,
          direccionFiscal: true,
        },
      },
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
              requisicion: {
                select: {
                  id: true,
                  solicitante: true,
                  unidadProductiva: true,
                },
              },
            },
          },
        },
      },
      _count: { select: { recepciones: true } },
    },
  });
  if (!oc) notFound();

  const requisicionOrigen = oc.detalle[0]?.requisicionDetalle.requisicion ?? null;

  const data: OcDetailData = {
    id: oc.id,
    numeroOc: oc.numeroOc,
    fechaEmision: oc.fechaEmision.toISOString(),
    estado: oc.estado,
    comprador: oc.comprador,
    observaciones: oc.observaciones,
    totalEstimado: oc.totalEstimado,
    fechaCancelacion: oc.fechaCancelacion?.toISOString() ?? null,
    canceladoPor: oc.canceladoPor,
    proveedor: {
      nombre: oc.proveedor.nombre,
      cuit: oc.proveedor.cuit,
      condicionIva: oc.proveedor.condicionIva,
      direccionFiscal: oc.proveedor.direccionFiscal,
    },
    requisicion: requisicionOrigen,
    detalle: oc.detalle.map((d) => ({
      id: d.id,
      itemCodigo: d.requisicionDetalle.item.codigo ?? "",
      itemDescripcion: d.requisicionDetalle.item.descripcion ?? "",
      unidadMedida: d.requisicionDetalle.item.unidadMedida,
      cantidadSolicitada: d.cantidadSolicitada,
      cantidadRecibida: d.cantidadRecibida,
      precioUnitario: d.precioUnitario,
      total: d.total,
    })),
  };

  const canCancel = admin && oc.estado === "Emitida";
  const hasRecepciones = oc._count.recepciones > 0;
  const canRecibir =
    isPañolero(session) &&
    (oc.estado === "Emitida" || oc.estado === "Parcialmente Recibida");

  return (
    <OcDetailClient
      data={data}
      canCancel={canCancel}
      hasRecepciones={hasRecepciones}
      canRecibir={canRecibir}
    />
  );
}
