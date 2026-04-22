import { prisma } from "@/lib/db";
import { formatOCNumber } from "@/lib/compras/oc-number";

import {
  FacturasPageClient,
  type FacturaPendienteOc,
} from "./facturas-page-client";
import type { FacturaRow, FacturasKpis } from "./facturas-list-client";

export const dynamic = "force-dynamic";

type PendingOcAccumulator = {
  id: number;
  numeroOc: string;
  fechaEmision: Date;
  estado: string;
  proveedorNombre: string;
  lineasPendientes: number;
  totalLineas: number;
  fechaUltimaRecepcion: Date | null;
  recepcionesCount: number;
};

export default async function FacturasListPage() {
  const [facturas, ocsConPendientes] = await Promise.all([
    prisma.factura.findMany({
      select: {
        id: true,
        numeroFactura: true,
        fechaFactura: true,
        total: true,
        netoGravado: true,
        proveedor: { select: { id: true, nombre: true } },
        _count: { select: { detalle: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.ordenCompra.findMany({
      where: {
        estado: { in: ["Parcialmente Recibida", "Completada", "Recibida"] },
        detalle: {
          some: {
            recepcionDetalle: {
              some: {
                facturado: false,
                recepcion: { cerradaSinFactura: false },
              },
            },
          },
        },
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
            recepcionDetalle: {
              select: {
                id: true,
                facturado: true,
                recepcion: {
                  select: {
                    id: true,
                    fechaRecepcion: true,
                    cerradaSinFactura: true,
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

  const rows: FacturaRow[] = facturas.map((f) => ({
    id: f.id,
    numeroFactura: f.numeroFactura,
    fechaFactura: f.fechaFactura.toISOString(),
    proveedor: f.proveedor.nombre,
    total: f.total,
    lineasCount: f._count.detalle,
  }));

  const proveedores = Array.from(
    new Set(rows.map((r) => r.proveedor).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const delMesList = facturas.filter((f) => f.fechaFactura >= monthStart);
  const montoMes = delMesList.reduce(
    (acc, f) => acc + (Number.isFinite(f.netoGravado) ? f.netoGravado : 0),
    0,
  );
  const proveedoresMes = new Set(delMesList.map((f) => f.proveedor.nombre)).size;

  const kpis: FacturasKpis = {
    total: facturas.length,
    delMes: delMesList.length,
    montoMes,
    proveedoresMes,
    monthStartIso: monthStart.toISOString(),
  };

  const pendientes: FacturaPendienteOc[] = ocsConPendientes
    .map((oc) => {
      const acc: PendingOcAccumulator = {
        id: oc.id,
        numeroOc: oc.numeroOc ?? formatOCNumber(oc.id),
        fechaEmision: oc.fechaEmision,
        estado: oc.estado,
        proveedorNombre: oc.proveedor.nombre,
        lineasPendientes: 0,
        totalLineas: 0,
        fechaUltimaRecepcion: null,
        recepcionesCount: 0,
      };
      const recepcionIds = new Set<number>();
      for (const d of oc.detalle) {
        for (const rd of d.recepcionDetalle) {
          if (rd.recepcion.cerradaSinFactura) continue;
          acc.totalLineas += 1;
          if (!rd.facturado) acc.lineasPendientes += 1;
          recepcionIds.add(rd.recepcion.id);
          if (
            !acc.fechaUltimaRecepcion ||
            rd.recepcion.fechaRecepcion > acc.fechaUltimaRecepcion
          ) {
            acc.fechaUltimaRecepcion = rd.recepcion.fechaRecepcion;
          }
        }
      }
      acc.recepcionesCount = recepcionIds.size;
      return acc;
    })
    .filter((acc) => acc.lineasPendientes > 0)
    .map((acc) => ({
      id: acc.id,
      numeroOc: acc.numeroOc,
      fechaEmision: acc.fechaEmision.toISOString(),
      estado: acc.estado,
      proveedor: acc.proveedorNombre,
      lineasPendientes: acc.lineasPendientes,
      totalLineas: acc.totalLineas,
      recepcionesCount: acc.recepcionesCount,
      fechaUltimaRecepcion: acc.fechaUltimaRecepcion
        ? acc.fechaUltimaRecepcion.toISOString()
        : null,
    }));

  const pendientesProveedores = Array.from(
    new Set(pendientes.map((p) => p.proveedor)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <FacturasPageClient
      historialRows={rows}
      historialProveedores={proveedores}
      historialKpis={kpis}
      pendientesOcs={pendientes}
      pendientesProveedores={pendientesProveedores}
    />
  );
}
