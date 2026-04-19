import { prisma } from "@/lib/db";

import { OtListClient, type OtRow } from "./ot-list-client";

export default async function OrdenesTrabajoListPage() {
  const [rows, usuarios] = await Promise.all([
    prisma.ordenTrabajo.findMany({
      select: {
        id: true,
        numeroOt: true,
        titulo: true,
        fechaCreacion: true,
        fechaFinalizacion: true,
        prioridad: true,
        estado: true,
        solicitante: { select: { id: true, nombre: true } },
        responsable: { select: { id: true, nombre: true } },
        localidad: { select: { nombre: true } },
        unidadProductiva: { select: { nombre: true } },
        _count: { select: { insumos: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.usuario.findMany({
      where: { estado: "activo" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const data: OtRow[] = rows.map((o) => ({
    id: o.id,
    numeroOt: o.numeroOt,
    titulo: o.titulo,
    fechaCreacion: o.fechaCreacion.toISOString(),
    fechaFinalizacion: o.fechaFinalizacion
      ? o.fechaFinalizacion.toISOString()
      : null,
    prioridad: o.prioridad,
    estado: o.estado,
    solicitante: o.solicitante?.nombre ?? null,
    solicitanteId: o.solicitante?.id ?? null,
    responsable: o.responsable?.nombre ?? null,
    responsableId: o.responsable?.id ?? null,
    localidad: o.localidad?.nombre ?? null,
    unidadProductiva: o.unidadProductiva?.nombre ?? null,
    insumosCount: o._count.insumos,
  }));

  return (
    <OtListClient
      rows={data}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
    />
  );
}
