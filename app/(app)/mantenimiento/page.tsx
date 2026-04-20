import { prisma } from "@/lib/db";

import { MantenimientosClient, type MantenimientoRow } from "./mantenimientos-client";
import { MANT_ESTADOS_ACTIVOS } from "@/lib/mantenimiento/estado";

export default async function MantenimientoListPage() {
  const rows = await prisma.mantenimiento.findMany({
    select: {
      id: true,
      tipo: true,
      estado: true,
      prioridad: true,
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
      tareas: { select: { realizada: true } },
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
    prioridad: m.prioridad ?? null,
    maquinaria: `${m.maquinaria.tipo.nombre} · ${m.maquinaria.nroSerie ?? "—"}`,
    maquinariaId: m.maquinaria.id,
    responsable: m.responsable.nombre,
    responsableId: m.responsable.id,
    fechaCreacion: m.fechaCreacion.toISOString(),
    fechaProgramada: m.fechaProgramada
      ? m.fechaProgramada.toISOString()
      : null,
    fechaInicio: m.fechaInicio ? m.fechaInicio.toISOString() : null,
    fechaFinalizacion: m.fechaFinalizacion
      ? m.fechaFinalizacion.toISOString()
      : null,
    diasAbiertos: computeDiasAbiertos(
      m.estado,
      m.fechaCreacion,
      m.fechaFinalizacion,
    ),
    tareasTotal: m.tareas.length,
    tareasRealizadas: m.tareas.filter((x) => x.realizada).length,
  }));

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const kpis = (() => {
    let activos = 0;
    let vencidas = 0;
    let proximas = 0;
    let enCurso = 0;
    let pendientes = 0;
    const activosSet = MANT_ESTADOS_ACTIVOS as readonly string[];
    for (const m of data) {
      const isActivo = activosSet.includes(m.estado);
      if (!isActivo) continue;
      activos++;
      if (m.estado === "Pendiente") pendientes++;
      if (m.estado === "En Reparación - Chacra" || m.estado === "En Reparación - Taller") {
        enCurso++;
      }
      const prog = m.fechaProgramada ? new Date(m.fechaProgramada) : null;
      if (prog) {
        if (prog < today) vencidas++;
        else if (prog < in7Days) proximas++;
      }
    }
    return { activos, vencidas, proximas, enCurso, pendientes };
  })();

  return (
    <MantenimientosClient
      rows={data}
      responsables={responsables.map((r) => ({ id: r.id, nombre: r.nombre }))}
      kpis={kpis}
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
