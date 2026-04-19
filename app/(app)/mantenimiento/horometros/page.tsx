import { prisma } from "@/lib/db";

import { HorometrosClient, type RegistroRow } from "./horometros-client";

export default async function HorometrosPage() {
  const [registros, maquinarias] = await Promise.all([
    prisma.registroHorasMaquinaria.findMany({
      select: {
        id: true,
        idMaquinaria: true,
        fechaRegistro: true,
        horasAnterior: true,
        horasNuevo: true,
        horasDiferencia: true,
        tipoActualizacion: true,
        observaciones: true,
        usuario: true,
        maquinaria: {
          select: {
            id: true,
            nroSerie: true,
            tipo: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ fechaRegistro: "desc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.maquinaria.findMany({
      where: { estado: "activo" },
      select: {
        id: true,
        nroSerie: true,
        horasAcumuladas: true,
        tipo: { select: { nombre: true } },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const rows: RegistroRow[] = registros.map((r) => ({
    id: r.id,
    maquinariaId: r.idMaquinaria,
    maquinaria: `${r.maquinaria.tipo.nombre} · ${r.maquinaria.nroSerie ?? "—"}`,
    fechaRegistro: r.fechaRegistro.toISOString(),
    horasAnterior: r.horasAnterior,
    horasNuevo: r.horasNuevo,
    horasDiferencia: r.horasDiferencia,
    tipoActualizacion: r.tipoActualizacion,
    observaciones: r.observaciones,
    usuario: r.usuario,
  }));

  return (
    <HorometrosClient
      rows={rows}
      maquinarias={maquinarias.map((m) => ({
        id: m.id,
        label: `${m.tipo.nombre} · ${m.nroSerie ?? "—"}`,
        horasAcumuladas: m.horasAcumuladas,
      }))}
    />
  );
}
