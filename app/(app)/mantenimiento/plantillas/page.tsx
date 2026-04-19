import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import { PlantillasClient, type PlantillaRow } from "./plantillas-client";

export default async function PlantillasListPage() {
  const session = await auth();
  const admin = isAdmin(session);

  const rows = await prisma.plantillaMantenimiento.findMany({
    select: {
      id: true,
      nombre: true,
      frecuenciaValor: true,
      frecuenciaUnidad: true,
      prioridad: true,
      creadoPor: true,
      fechaCreacion: true,
      tipoMaquinaria: { select: { id: true, nombre: true } },
      _count: { select: { insumos: true, tareas: true, mantenimientos: true } },
    },
    orderBy: [{ tipoMaquinaria: { nombre: "asc" } }, { nombre: "asc" }],
  });

  const data: PlantillaRow[] = rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipoMaquinariaId: p.tipoMaquinaria.id,
    tipoMaquinariaNombre: p.tipoMaquinaria.nombre,
    frecuenciaValor: p.frecuenciaValor,
    frecuenciaUnidad: p.frecuenciaUnidad,
    prioridad: p.prioridad,
    creadoPor: p.creadoPor,
    fechaCreacion: p.fechaCreacion.toISOString(),
    insumosCount: p._count.insumos,
    tareasCount: p._count.tareas,
    mantenimientosCount: p._count.mantenimientos,
  }));

  return <PlantillasClient rows={data} isAdmin={admin} />;
}
