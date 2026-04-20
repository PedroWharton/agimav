import { prisma } from "@/lib/db";

import {
  RecepcionesListClient,
  type RecepcionRow,
  type RecepcionesKpis,
} from "./recepciones-list-client";

export default async function RecepcionesListPage() {
  const recepciones = await prisma.recepcion.findMany({
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
  });

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

  return (
    <RecepcionesListClient
      rows={rows}
      proveedores={proveedores}
      kpis={kpis}
    />
  );
}
