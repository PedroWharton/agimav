import { prisma } from "@/lib/db";

import {
  FacturasListClient,
  type FacturaRow,
  type FacturasKpis,
} from "./facturas-list-client";

export default async function FacturasListPage() {
  const facturas = await prisma.factura.findMany({
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

  return (
    <FacturasListClient rows={rows} proveedores={proveedores} kpis={kpis} />
  );
}
