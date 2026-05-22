import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import { MovimientoDetailClient } from "./detail-client";

export const dynamic = "force-dynamic";

export default async function MovimientoDiarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "inventario.view");
  const canManage = hasPermission(session, "inventario.movimiento.create");

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const registro = await prisma.movimientoDiario.findUnique({
    where: { id },
    include: { lineas: { orderBy: { id: "asc" } } },
  });
  if (!registro) notFound();

  return (
    <MovimientoDetailClient
      canManage={canManage}
      data={{
        id: registro.id,
        fecha: registro.fecha.toISOString(),
        usuario: registro.usuario,
        sector: registro.sector,
        localidad: registro.localidad,
        observaciones: registro.observaciones,
        lineas: registro.lineas.map((l) => ({
          id: l.id,
          codigoItem: l.codigoItem,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          unidadMedida: l.unidadMedida,
          tipo: l.tipo,
          devuelto: l.devuelto,
          fechaDevolucion: l.fechaDevolucion
            ? l.fechaDevolucion.toISOString()
            : null,
          monto: l.monto,
          justificacion: l.justificacion,
        })),
      }}
    />
  );
}
