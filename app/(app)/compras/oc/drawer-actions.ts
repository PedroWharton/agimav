"use server";

import { prisma } from "@/lib/db";

export type OcDrawerLinea = {
  id: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadSolicitada: number;
  cantidadRecibida: number;
  precioUnitario: number;
  total: number;
};

export type OcDrawerRecepcion = {
  id: number;
  numeroRemito: string;
  fechaRecepcion: string;
  recibidoPor: string;
  lineasCount: number;
};

export type OcDrawerFactura = {
  id: number;
  numeroFactura: string;
  fechaFactura: string;
  total: number;
};

export type OcDrawerData = {
  id: number;
  numeroOc: string | null;
  fechaEmision: string;
  estado: string;
  comprador: string | null;
  observaciones: string | null;
  totalEstimado: number;
  proveedor: {
    nombre: string;
    cuit: string | null;
  };
  detalle: OcDrawerLinea[];
  recepciones: OcDrawerRecepcion[];
  facturas: OcDrawerFactura[];
};

export async function fetchOcDrawerData(id: number): Promise<OcDrawerData | null> {
  const oc = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: { select: { nombre: true, cuit: true } },
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
          recepcionDetalle: {
            select: { id: true },
          },
        },
      },
      recepciones: {
        orderBy: { fechaRecepcion: "desc" },
        select: {
          id: true,
          numeroRemito: true,
          fechaRecepcion: true,
          recibidoPor: true,
          _count: { select: { detalle: true } },
        },
      },
    },
  });

  if (!oc) return null;

  // Collect all recepcionDetalle ids from this OC's lines, then find
  // any facturas that invoice those recepciones.
  const recepcionDetalleIds = oc.detalle.flatMap((d) =>
    d.recepcionDetalle.map((rd) => rd.id),
  );

  const facturaDetalles = recepcionDetalleIds.length
    ? await prisma.facturaDetalle.findMany({
        where: { recepcionDetalleId: { in: recepcionDetalleIds } },
        select: {
          factura: {
            select: {
              id: true,
              numeroFactura: true,
              fechaFactura: true,
              total: true,
            },
          },
        },
      })
    : [];

  const seenFacturaIds = new Set<number>();
  const facturas: OcDrawerFactura[] = [];
  for (const fd of facturaDetalles) {
    if (seenFacturaIds.has(fd.factura.id)) continue;
    seenFacturaIds.add(fd.factura.id);
    facturas.push({
      id: fd.factura.id,
      numeroFactura: fd.factura.numeroFactura,
      fechaFactura: fd.factura.fechaFactura.toISOString(),
      total: fd.factura.total,
    });
  }
  facturas.sort((a, b) => (a.fechaFactura < b.fechaFactura ? 1 : -1));

  return {
    id: oc.id,
    numeroOc: oc.numeroOc,
    fechaEmision: oc.fechaEmision.toISOString(),
    estado: oc.estado,
    comprador: oc.comprador,
    observaciones: oc.observaciones,
    totalEstimado: oc.totalEstimado,
    proveedor: {
      nombre: oc.proveedor.nombre,
      cuit: oc.proveedor.cuit,
    },
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
    recepciones: oc.recepciones.map((r) => ({
      id: r.id,
      numeroRemito: r.numeroRemito,
      fechaRecepcion: r.fechaRecepcion.toISOString(),
      recibidoPor: r.recibidoPor,
      lineasCount: r._count.detalle,
    })),
    facturas,
  };
}
