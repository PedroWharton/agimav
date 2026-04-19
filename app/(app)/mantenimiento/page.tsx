import { prisma } from "@/lib/db";

import { MantenimientosClient, type MantenimientoRow } from "./mantenimientos-client";

export default async function MantenimientoListPage() {
  const rows = await prisma.mantenimiento.findMany({
    select: {
      id: true,
      tipo: true,
      estado: true,
      fechaCreacion: true,
      fechaInicio: true,
      fechaFinalizacion: true,
      fechaProgramada: true,
      maquinaria: {
        select: {
          id: true,
          nroSerie: true,
          tipo: { select: { nombre: true } },
        },
      },
      responsable: { select: { id: true, nombre: true } },
    },
    orderBy: { id: "desc" },
  });

  const responsables = await prisma.usuario.findMany({
    where: { estado: "activo" },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const data: MantenimientoRow[] = rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    estado: m.estado,
    maquinaria: `${m.maquinaria.tipo.nombre} · ${m.maquinaria.nroSerie ?? "—"}`,
    maquinariaId: m.maquinaria.id,
    responsable: m.responsable.nombre,
    responsableId: m.responsable.id,
    fechaCreacion: m.fechaCreacion.toISOString(),
    diasAbiertos: computeDiasAbiertos(
      m.estado,
      m.fechaCreacion,
      m.fechaFinalizacion,
    ),
  }));

  return (
    <MantenimientosClient
      rows={data}
      responsables={responsables.map((r) => ({ id: r.id, nombre: r.nombre }))}
    />
  );
}

function computeDiasAbiertos(
  estado: string,
  fechaCreacion: Date,
  fechaFinalizacion: Date | null,
): number {
  const end =
    estado === "Finalizado" || estado === "Cancelado"
      ? (fechaFinalizacion ?? new Date())
      : new Date();
  const diffMs = end.getTime() - fechaCreacion.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
