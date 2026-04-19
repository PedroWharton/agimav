"use server";

import { prisma } from "@/lib/db";

import type { MaqRange, MaqResult, MaqRow } from "./types";

function rangeToGte(range: MaqRange): Date | null {
  const now = new Date();
  switch (range) {
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "todo":
      return null;
  }
}

export async function computeMaqMetrics(
  range: MaqRange,
): Promise<MaqResult> {
  const gte = rangeToGte(range);

  const maquinas = await prisma.maquinaria.findMany({
    select: {
      id: true,
      nroSerie: true,
      tipo: { select: { id: true, nombre: true } },
    },
  });
  const totalMaquinas = maquinas.length;

  // Principal atributo value per máquina (via raw query for efficiency)
  const principalRows = await prisma.$queryRaw<
    { maquinaria_id: number; principal: string | null }[]
  >`SELECT mn.maquinaria_id, mav.value_text as principal
    FROM maquina_nodos mn
    JOIN maquina_atributos_valores mav ON mav.nodo_id = mn.id
    JOIN nivel_atributos na ON na.id = mav.atributo_def_id
    WHERE mn.parent_node_id IS NULL
      AND na.es_principal = true`;
  const principalMap = new Map(
    principalRows.map((r) => [r.maquinaria_id, r.principal]),
  );

  // Per-máquina mantenimientos in range
  const mantWhere: {
    maquinariaId?: number;
    fechaCreacion?: { gte: Date };
  } = {};
  if (gte) mantWhere.fechaCreacion = { gte };

  const mantenimientos = await prisma.mantenimiento.findMany({
    where: mantWhere,
    select: {
      id: true,
      maquinariaId: true,
      tipo: true,
      fechaCreacion: true,
    },
    orderBy: { fechaCreacion: "asc" },
  });

  const mantByMaq = new Map<
    number,
    { id: number; tipo: string; fecha: Date }[]
  >();
  for (const m of mantenimientos) {
    const arr = mantByMaq.get(m.maquinariaId) ?? [];
    arr.push({ id: m.id, tipo: m.tipo, fecha: m.fechaCreacion });
    mantByMaq.set(m.maquinariaId, arr);
  }

  // Costos por mantenimiento (sum of insumos)
  const costos =
    mantenimientos.length > 0
      ? await prisma.mantenimientoInsumo.groupBy({
          by: ["mantenimientoId"],
          _sum: { costoTotal: true },
          where: {
            mantenimientoId: { in: mantenimientos.map((m) => m.id) },
          },
        })
      : [];
  const costoByMant = new Map(
    costos.map((c) => [c.mantenimientoId, c._sum.costoTotal ?? 0]),
  );

  // Horas operadas: delta entre primer y último RegistroHorasMaquinaria en rango
  const horasWhere: { fechaRegistro?: { gte: Date } } = {};
  if (gte) horasWhere.fechaRegistro = { gte };
  const registros = await prisma.registroHorasMaquinaria.findMany({
    where: horasWhere,
    select: {
      idMaquinaria: true,
      horasNuevo: true,
      fechaRegistro: true,
    },
    orderBy: { fechaRegistro: "asc" },
  });
  const registrosByMaq = new Map<number, number[]>();
  for (const r of registros) {
    const arr = registrosByMaq.get(r.idMaquinaria) ?? [];
    arr.push(r.horasNuevo);
    registrosByMaq.set(r.idMaquinaria, arr);
  }

  const rows: MaqRow[] = maquinas.map((m) => {
    const mants = mantByMaq.get(m.id) ?? [];
    const correctivosArr = mants.filter((x) => x.tipo === "correctivo");
    const preventivosArr = mants.filter((x) => x.tipo === "preventivo");

    let mtbfDias: number | null = null;
    if (correctivosArr.length >= 2) {
      let total = 0;
      for (let i = 1; i < correctivosArr.length; i++) {
        const diff =
          correctivosArr[i]!.fecha.getTime() -
          correctivosArr[i - 1]!.fecha.getTime();
        total += diff / (1000 * 60 * 60 * 24);
      }
      mtbfDias = total / (correctivosArr.length - 1);
    }

    const horasArr = registrosByMaq.get(m.id) ?? [];
    const horasOperadas =
      horasArr.length >= 2
        ? horasArr[horasArr.length - 1]! - horasArr[0]!
        : null;

    const costoTotal = mants.reduce(
      (acc, mm) => acc + (costoByMant.get(mm.id) ?? 0),
      0,
    );

    const principal = principalMap.get(m.id);
    const nombre =
      (principal && principal.trim()) ||
      m.nroSerie ||
      `#${m.id}`;

    return {
      id: m.id,
      nombre,
      tipoId: m.tipo?.id ?? null,
      tipoNombre: m.tipo?.nombre ?? null,
      correctivos: correctivosArr.length,
      preventivos: preventivosArr.length,
      mtbfDias,
      horasOperadas,
      costoTotal,
    };
  });

  const totalMants = (r: MaqRow) => r.correctivos + r.preventivos;
  rows.sort((a, b) => b.costoTotal - a.costoTotal);

  const sinHistorial = rows.filter((r) => totalMants(r) === 0).length;

  return { rows, sinHistorial, totalMaquinas };
}
