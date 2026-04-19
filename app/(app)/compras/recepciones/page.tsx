import { prisma } from "@/lib/db";

import { RecepcionesListClient, type RecepcionRow } from "./recepciones-list-client";

export default async function RecepcionesListPage() {
  const recepciones = await prisma.recepcion.findMany({
    select: {
      id: true,
      numeroRemito: true,
      fechaRecepcion: true,
      recibidoPor: true,
      oc: {
        select: {
          id: true,
          numeroOc: true,
          proveedor: { select: { nombre: true } },
        },
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
  }));

  const proveedores = Array.from(
    new Set(rows.map((r) => r.proveedor).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  return <RecepcionesListClient rows={rows} proveedores={proveedores} />;
}
