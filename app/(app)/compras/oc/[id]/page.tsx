import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import { OcDetailClient, type OcDetailData } from "./oc-detail-client";

export default async function OcDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "compras.view");
  const canUpdateOc = hasPermission(session, "compras.oc.update");
  const canCreateRecepcion = hasPermission(session, "compras.recepcion.create");

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
      recepciones: {
        select: {
          id: true,
          numeroRemito: true,
          fechaRecepcion: true,
          cerradaSinFactura: true,
        },
        orderBy: { id: "desc" },
      },
      _count: { select: { recepciones: true } },
    },
  });
  if (!oc) notFound();

  const solicitudOrigen = oc.detalle[0]?.requisicionDetalle.requisicion ?? null;

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
    solicitud: solicitudOrigen,
    recepciones: oc.recepciones.map((r) => ({
      id: r.id,
      numeroRemito: r.numeroRemito,
      fechaRecepcion: r.fechaRecepcion.toISOString(),
      cerradaSinFactura: r.cerradaSinFactura,
    })),
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

  const canCancel = canUpdateOc && oc.estado === "Emitida";
  const hasRecepciones = oc._count.recepciones > 0;
  const canRecibir =
    canCreateRecepcion &&
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
