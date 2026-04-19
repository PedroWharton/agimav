import { prisma } from "@/lib/db";

import { OcListClient, type OcRow } from "./oc-list-client";

export default async function OcListPage() {
  const ocs = await prisma.ordenCompra.findMany({
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
  });

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

  const proveedores = Array.from(
    new Set(rows.map((r) => r.proveedor).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  return <OcListClient rows={rows} proveedores={proveedores} />;
}
