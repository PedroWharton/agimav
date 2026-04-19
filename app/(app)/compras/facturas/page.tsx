import { prisma } from "@/lib/db";

import { FacturasListClient, type FacturaRow } from "./facturas-list-client";

export default async function FacturasListPage() {
  const facturas = await prisma.factura.findMany({
    select: {
      id: true,
      numeroFactura: true,
      fechaFactura: true,
      total: true,
      proveedor: { select: { id: true, nombre: true } },
      _count: { select: { detalle: true } },
    },
    orderBy: { id: "desc" },
  });

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

  return <FacturasListClient rows={rows} proveedores={proveedores} />;
}
