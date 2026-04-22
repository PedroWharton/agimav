import { prisma } from "@/lib/db";

import { OcPageClient } from "./oc-page-client";
import type { OcRow } from "./oc-list-client";
import type {
  AggregatedItemRow,
  ProveedorOption,
} from "./oc-pendientes-client";

export default async function OcListPage() {
  const [ocs, pendientes, proveedores] = await Promise.all([
    prisma.ordenCompra.findMany({
      select: {
        id: true,
        numeroOc: true,
        fechaEmision: true,
        comprador: true,
        estado: true,
        totalEstimado: true,
        proveedor: { select: { nombre: true } },
        _count: { select: { detalle: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.requisicionDetalle.findMany({
      where: {
        estado: "Pendiente",
        requisicion: {
          estado: { in: ["Aprobada", "Asignado a Proveedor"] },
        },
      },
      select: {
        id: true,
        itemId: true,
        cantidad: true,
        cantidadAprobada: true,
        prioridadItem: true,
        proveedorAsignadoId: true,
        requisicionId: true,
        requisicion: {
          select: { prioridad: true, fechaCreacion: true },
        },
        item: {
          select: { codigo: true, descripcion: true, unidadMedida: true },
        },
      },
    }),
    prisma.proveedor.findMany({
      where: { estado: "activo" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rows: OcRow[] = ocs.map((o) => ({
    id: o.id,
    numeroOc: o.numeroOc,
    fechaEmision: o.fechaEmision.toISOString(),
    proveedor: o.proveedor.nombre,
    comprador: o.comprador,
    estado: o.estado,
    totalEstimado: o.totalEstimado,
    lineasCount: o._count.detalle,
  }));

  const proveedoresList = Array.from(
    new Set(rows.map((r) => r.proveedor).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  type Acc = {
    itemId: number;
    itemCodigo: string;
    itemDescripcion: string;
    unidadMedida: string | null;
    cantidadTotal: number;
    urgente: boolean;
    solicitudes: Set<number>;
    oldestSolicitudAt: number;
    detalleIds: number[];
    proveedorSugeridoId: number | null;
  };

  const byItem = new Map<number, Acc>();
  for (const d of pendientes) {
    let acc = byItem.get(d.itemId);
    if (!acc) {
      acc = {
        itemId: d.itemId,
        itemCodigo: d.item.codigo ?? "",
        itemDescripcion: d.item.descripcion ?? "",
        unidadMedida: d.item.unidadMedida,
        cantidadTotal: 0,
        urgente: false,
        solicitudes: new Set<number>(),
        oldestSolicitudAt: d.requisicion.fechaCreacion.getTime(),
        detalleIds: [],
        proveedorSugeridoId: null,
      };
      byItem.set(d.itemId, acc);
    }
    acc.cantidadTotal += d.cantidadAprobada ?? d.cantidad;
    acc.solicitudes.add(d.requisicionId);
    acc.detalleIds.push(d.id);
    acc.oldestSolicitudAt = Math.min(
      acc.oldestSolicitudAt,
      d.requisicion.fechaCreacion.getTime(),
    );
    const lineUrgente =
      d.prioridadItem === "Urgente" || d.requisicion.prioridad === "Urgente";
    if (lineUrgente) acc.urgente = true;
    if (acc.proveedorSugeridoId == null && d.proveedorAsignadoId != null) {
      acc.proveedorSugeridoId = d.proveedorAsignadoId;
    }
  }

  const aggregated: AggregatedItemRow[] = Array.from(byItem.values()).map(
    (acc) => ({
      itemId: acc.itemId,
      itemCodigo: acc.itemCodigo,
      itemDescripcion: acc.itemDescripcion,
      unidadMedida: acc.unidadMedida,
      cantidadTotal: acc.cantidadTotal,
      urgente: acc.urgente,
      solicitudesCount: acc.solicitudes.size,
      solicitudIds: Array.from(acc.solicitudes).sort((a, b) => a - b),
      oldestSolicitudAt: new Date(acc.oldestSolicitudAt).toISOString(),
      proveedorSugeridoId: acc.proveedorSugeridoId,
    }),
  );

  aggregated.sort((a, b) => {
    if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
    return a.oldestSolicitudAt.localeCompare(b.oldestSolicitudAt);
  });

  const proveedorOptions: ProveedorOption[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
  }));

  return (
    <OcPageClient
      emitidasRows={rows}
      emitidasProveedores={proveedoresList}
      pendientes={aggregated}
      proveedorOptions={proveedorOptions}
    />
  );
}
