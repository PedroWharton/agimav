/**
 * Phase 4 reality-check probe for the Maquinaria module.
 *
 * Reports: tipo count + per-tipo instance count, nivel depth distribution,
 * atributo count and data_type mix per tipo, ref-atributo source_ref usage,
 * tabla_config populated-ness.
 *
 * Usage: tsx --env-file=.env.local scripts/maquinaria-probe.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tipos = await prisma.maquinariaTipo.findMany({
    include: {
      niveles: {
        include: {
          atributos: true,
        },
      },
      _count: { select: { maquinarias: true, tablaConfigs: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log("=== Tipos ===");
  console.log(`Total tipos: ${tipos.length}`);
  for (const tipo of tipos) {
    // compute max depth by walking parent chain
    const byId = new Map(tipo.niveles.map((n) => [n.id, n]));
    let maxDepth = 0;
    for (const n of tipo.niveles) {
      let d = 0;
      let cur: typeof n | undefined = n;
      while (cur && cur.parentLevelId) {
        cur = byId.get(cur.parentLevelId);
        d++;
        if (d > 20) break;
      }
      if (d > maxDepth) maxDepth = d;
    }
    const atributoCount = tipo.niveles.reduce(
      (s, n) => s + n.atributos.length,
      0,
    );
    const principalCount = tipo.niveles.reduce(
      (s, n) => s + n.atributos.filter((a) => a.esPrincipal).length,
      0,
    );
    const dataTypes = tipo.niveles
      .flatMap((n) => n.atributos.map((a) => a.dataType))
      .reduce<Record<string, number>>((acc, dt) => {
        acc[dt] = (acc[dt] ?? 0) + 1;
        return acc;
      }, {});
    const sourceRefs = tipo.niveles
      .flatMap((n) => n.atributos.map((a) => a.sourceRef))
      .filter((s): s is string => !!s);
    const permiteInv = tipo.niveles.filter((n) => n.permiteInventario).length;

    console.log(
      `\n[${tipo.id}] ${tipo.nombre} — instancias=${tipo._count.maquinarias}, niveles=${tipo.niveles.length} (permiteInv=${permiteInv}), depth(raíz=0)=${maxDepth}, atributos=${atributoCount}, esPrincipal=${principalCount}, tablaConfig rows=${tipo._count.tablaConfigs}`,
    );
    console.log(`  dataTypes: ${JSON.stringify(dataTypes)}`);
    if (sourceRefs.length > 0) {
      const uniq = Array.from(new Set(sourceRefs));
      console.log(`  sourceRefs: ${JSON.stringify(uniq)}`);
    }
  }

  console.log("\n=== Global ===");
  const totalMaquinarias = await prisma.maquinaria.count();
  const totalNodos = await prisma.maquinaNodo.count();
  const totalValores = await prisma.maquinaAtributoValor.count();
  const valoresWithText = await prisma.maquinaAtributoValor.count({
    where: { valueText: { not: null } },
  });
  const valoresWithNum = await prisma.maquinaAtributoValor.count({
    where: { valueNum: { not: null } },
  });
  const valoresWithDate = await prisma.maquinaAtributoValor.count({
    where: { valueDate: { not: null } },
  });
  console.log(
    `maquinarias=${totalMaquinarias}, nodos=${totalNodos}, valores=${totalValores} (text=${valoresWithText}, num=${valoresWithNum}, date=${valoresWithDate})`,
  );

  const tablaConfigRows = await prisma.tablaConfig.count();
  const tablaConfigByKind = await prisma.tablaConfig.groupBy({
    by: ["columnKind"],
    _count: true,
  });
  console.log(`tabla_config rows=${tablaConfigRows}`);
  console.log(`  by kind: ${JSON.stringify(tablaConfigByKind)}`);

  // Hour meter usage
  const regHoras = await prisma.registroHorasMaquinaria.count();
  console.log(`registro_horas_maquinaria rows=${regHoras}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
