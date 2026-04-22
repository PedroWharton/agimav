import { prisma } from "@/lib/db";
import { formatOCNumber } from "@/lib/compras/oc-number";

import {
  RecepcionesPageClient,
  type RecepcionPendienteOc,
  type RecepcionPendienteLinea,
} from "./recepciones-page-client";
import {
  type RecepcionRow,
  type RecepcionesKpis,
} from "./recepciones-list-client";

export default async function RecepcionesListPage() {
  const [recepciones, ocsPendientes] = await Promise.all([
    prisma.recepcion.findMany({
      select: {
        id: true,
        numeroRemito: true,
        fechaRecepcion: true,
        recibidoPor: true,
        cerradaSinFactura: true,
        oc: {
          select: {
            id: true,
            numeroOc: true,
            proveedor: { select: { nombre: true } },
          },
        },
        detalle: {
          select: { facturado: true },
        },
        _count: { select: { detalle: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.ordenCompra.findMany({
      where: {
        estado: { in: ["Emitida", "Parcialmente Recibida"] },
      },
      select: {
        id: true,
        numeroOc: true,
        fechaEmision: true,
        estado: true,
        proveedor: { select: { nombre: true } },
        detalle: {
          select: {
            id: true,
            cantidadSolicitada: true,
            cantidadRecibida: true,
            requisicionDetalle: {
              select: {
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
      orderBy: { id: "desc" },
    }),
  ]);

  const rows: RecepcionRow[] = recepciones.map((r) => ({
    id: r.id,
    numeroRemito: r.numeroRemito,
    fechaRecepcion: r.fechaRecepcion.toISOString(),
    recibidoPor: r.recibidoPor,
    ocId: r.oc.id,
    ocNumero: r.oc.numeroOc ?? `#${r.oc.id}`,
    proveedor: r.oc.proveedor.nombre,
    lineasCount: r._count.detalle,
    cerradaSinFactura: r.cerradaSinFactura,
    algunaLineaSinFacturar: r.detalle.some((d) => !d.facturado),
  }));

  const proveedores = Array.from(
    new Set(rows.map((r) => r.proveedor).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const kpis: RecepcionesKpis = {
    total: rows.length,
    delMes: rows.filter((r) => new Date(r.fechaRecepcion) >= monthStart).length,
    sinFacturar: rows.filter(
      (r) => !r.cerradaSinFactura && r.algunaLineaSinFacturar,
    ).length,
    cerradas: rows.filter((r) => r.cerradaSinFactura).length,
    monthStartIso: monthStart.toISOString(),
  };

  const pendientesOcs: RecepcionPendienteOc[] = ocsPendientes
    .map((oc) => {
      const lineas: RecepcionPendienteLinea[] = oc.detalle
        .map((d) => {
          const pendiente = Math.max(0, d.cantidadSolicitada - d.cantidadRecibida);
          return {
            ocDetalleId: d.id,
            itemCodigo: d.requisicionDetalle.item.codigo ?? "",
            itemDescripcion: d.requisicionDetalle.item.descripcion ?? "",
            unidadMedida: d.requisicionDetalle.item.unidadMedida,
            cantidadSolicitada: d.cantidadSolicitada,
            cantidadRecibida: d.cantidadRecibida,
            pendiente,
          };
        })
        .filter((l) => l.pendiente > 0);
      return {
        id: oc.id,
        numeroOc: oc.numeroOc ?? formatOCNumber(oc.id),
        fechaEmision: oc.fechaEmision.toISOString(),
        proveedor: oc.proveedor.nombre,
        estado: oc.estado,
        totalLineas: oc.detalle.length,
        pendientesLineas: lineas.length,
        lineas,
      };
    })
    .filter((oc) => oc.lineas.length > 0);

  const pendientesProveedores = Array.from(
    new Set(pendientesOcs.map((o) => o.proveedor)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <RecepcionesPageClient
      historialRows={rows}
      historialProveedores={proveedores}
      historialKpis={kpis}
      pendientesOcs={pendientesOcs}
      pendientesProveedores={pendientesProveedores}
    />
  );
}
