"use server";

import { prisma } from "@/lib/db";
import { rangeToGte } from "@/lib/stats/range";

import type { MaqRange, MaqResult, MaqRow } from "./types";

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
      horasAcumuladasSnapshot: true,
    },
    orderBy: { fechaCreacion: "asc" },
  });

  const mantByMaq = new Map<
    number,
    { id: number; tipo: string; fecha: Date; horas: number | null }[]
  >();
  for (const m of mantenimientos) {
    const arr = mantByMaq.get(m.maquinariaId) ?? [];
    arr.push({
      id: m.id,
      tipo: m.tipo,
      fecha: m.fechaCreacion,
      horas: m.horasAcumuladasSnapshot,
    });
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

    // MTBF: prefer hour-based if every consecutive pair has snapshots on both
    // ends (industry-standard semantics — delta between horas_acumuladas at
    // successive correctivos). Fall back to date-based when any pair is
    // missing a snapshot, which is typical for legacy rows imported from
    // flota7.db. Mixed coverage (some pairs hourly, others date) still falls
    // back to date-based — rather than averaging two different units, keep
    // one consistent unit per row.
    let mtbf: number | null = null;
    let mtbfSource: MaqRow["mtbfSource"] = null;
    if (correctivosArr.length >= 2) {
      const allHaveHoras = correctivosArr.every((c) => c.horas !== null);
      if (allHaveHoras) {
        let totalHoras = 0;
        for (let i = 1; i < correctivosArr.length; i++) {
          totalHoras +=
            (correctivosArr[i]!.horas as number) -
            (correctivosArr[i - 1]!.horas as number);
        }
        mtbf = totalHoras / (correctivosArr.length - 1);
        mtbfSource = "horas";
      } else {
        let totalDias = 0;
        for (let i = 1; i < correctivosArr.length; i++) {
          totalDias +=
            (correctivosArr[i]!.fecha.getTime() -
              correctivosArr[i - 1]!.fecha.getTime()) /
            (1000 * 60 * 60 * 24);
        }
        mtbf = totalDias / (correctivosArr.length - 1);
        mtbfSource = "dias";
      }
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
      mtbf,
      mtbfSource,
      horasOperadas,
      costoTotal,
    };
  });

  const totalMants = (r: MaqRow) => r.correctivos + r.preventivos;
  rows.sort((a, b) => b.costoTotal - a.costoTotal);

  const sinHistorial = rows.filter((r) => totalMants(r) === 0).length;

  return { rows, sinHistorial, totalMaquinas };
}
