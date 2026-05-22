/**
 * WS-B reality-check probe for the Localidad / Unidad Productiva merge.
 *
 * Reports: Localidad↔UP cardinality, FK usage on Proveedor / OrdenTrabajo /
 * MovimientoDiario, the denormalized TEXT localidad/unidadProductiva fields on
 * Requisicion, and Usuario volume for the per-UP RBAC scoping.
 *
 * Read-only — only counts and selects, no writes.
 *
 * Usage: tsx --env-file=.env.local scripts/ws-b-probe.ts
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

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  // ── Localidad ↔ UnidadProductiva ────────────────────────────────────
  section("Localidad ↔ Unidad Productiva");
  const localidades = await prisma.localidad.findMany({
    select: {
      id: true,
      nombre: true,
      _count: {
        select: {
          unidadesProductivas: true,
          proveedores: true,
          ordenesTrabajo: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });
  const ups = await prisma.unidadProductiva.findMany({
    select: { id: true, nombre: true, localidadId: true },
    orderBy: { id: "asc" },
  });
  console.log(`Localidades: ${localidades.length}`);
  console.log(`Unidades productivas: ${ups.length}`);
  console.log(
    `UPs sin localidad: ${ups.filter((u) => u.localidadId == null).length}`,
  );

  console.log("\nPor localidad (UPs / proveedores / OTs):");
  for (const l of localidades) {
    console.log(
      `  [${l.id}] ${l.nombre}: ${l._count.unidadesProductivas} UP, ` +
        `${l._count.proveedores} prov, ${l._count.ordenesTrabajo} OT`,
    );
  }
  const upCounts = localidades.map((l) => l._count.unidadesProductivas);
  console.log(
    `\nCardinalidad → localidades con 0 UP: ${upCounts.filter((c) => c === 0).length}, ` +
      `con 1 UP: ${upCounts.filter((c) => c === 1).length}, ` +
      `con >1 UP: ${upCounts.filter((c) => c > 1).length} ` +
      `(max ${Math.max(0, ...upCounts)})`,
  );

  // ── Listado de UPs ──────────────────────────────────────────────────
  section("Unidades productivas (nombre — localidad)");
  const locById = new Map(localidades.map((l) => [l.id, l.nombre]));
  for (const u of ups) {
    const loc = u.localidadId
      ? (locById.get(u.localidadId) ?? `?#${u.localidadId}`)
      : "(sin localidad)";
    console.log(`  [${u.id}] ${u.nombre} — ${loc}`);
  }

  // ── Proveedor.localidadId ───────────────────────────────────────────
  section("Proveedor");
  const provTotal = await prisma.proveedor.count();
  const provConLoc = await prisma.proveedor.count({
    where: { localidadId: { not: null } },
  });
  console.log(
    `Proveedores: ${provTotal} — con localidad: ${provConLoc}, sin: ${provTotal - provConLoc}`,
  );

  // ── OrdenTrabajo: localidadId vs unidadProductivaId ─────────────────
  section("OrdenTrabajo — localidad vs unidad productiva");
  const otTotal = await prisma.ordenTrabajo.count();
  const otConLoc = await prisma.ordenTrabajo.count({
    where: { localidadId: { not: null } },
  });
  const otConUp = await prisma.ordenTrabajo.count({
    where: { unidadProductivaId: { not: null } },
  });
  const otConAmbos = await prisma.ordenTrabajo.count({
    where: { localidadId: { not: null }, unidadProductivaId: { not: null } },
  });
  console.log(
    `OTs: ${otTotal} — con localidadId: ${otConLoc}, ` +
      `con unidadProductivaId: ${otConUp}, con ambos: ${otConAmbos}`,
  );
  const otsAmbos = await prisma.ordenTrabajo.findMany({
    where: { localidadId: { not: null }, unidadProductivaId: { not: null } },
    select: {
      id: true,
      localidadId: true,
      unidadProductiva: { select: { localidadId: true } },
    },
  });
  const discrepan = otsAmbos.filter(
    (o) => o.localidadId !== o.unidadProductiva?.localidadId,
  ).length;
  console.log(
    `OTs con ambos donde ot.localidad ≠ up.localidad: ${discrepan}`,
  );

  // ── MovimientoDiario ────────────────────────────────────────────────
  section("MovimientoDiario");
  const mdTotal = await prisma.movimientoDiario.count();
  const mdConLocId = await prisma.movimientoDiario.count({
    where: { localidadId: { not: null } },
  });
  const mdConUpId = await prisma.movimientoDiario.count({
    where: { unidadProductivaId: { not: null } },
  });
  const mdConLocTxt = await prisma.movimientoDiario.count({
    where: { localidad: { not: null } },
  });
  console.log(
    `Movimientos: ${mdTotal} — localidadId: ${mdConLocId}, ` +
      `unidadProductivaId: ${mdConUpId}, localidad(texto): ${mdConLocTxt}`,
  );

  // ── Requisicion: campos de texto ────────────────────────────────────
  section("Requisicion — campos de texto localidad / unidadProductiva");
  const reqs = await prisma.requisicion.findMany({
    select: { localidad: true, unidadProductiva: true },
  });
  const reqLoc = new Map<string, number>();
  const reqUp = new Map<string, number>();
  for (const r of reqs) {
    reqLoc.set(r.localidad, (reqLoc.get(r.localidad) ?? 0) + 1);
    reqUp.set(r.unidadProductiva, (reqUp.get(r.unidadProductiva) ?? 0) + 1);
  }
  console.log(`Requisiciones: ${reqs.length}`);
  console.log("Valores distintos de localidad (texto):");
  for (const [k, v] of [...reqLoc.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${k}": ${v}`);
  }
  console.log("Valores distintos de unidadProductiva (texto):");
  for (const [k, v] of [...reqUp.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${k}": ${v}`);
  }

  // ── Mantenimiento UP usage ──────────────────────────────────────────
  section("Mantenimiento");
  const mantTotal = await prisma.mantenimiento.count();
  const mantConUp = await prisma.mantenimiento.count({
    where: { unidadProductivaId: { not: null } },
  });
  const mantConTaller = await prisma.mantenimiento.count({
    where: { tallerAsignadoId: { not: null } },
  });
  console.log(
    `Mantenimientos: ${mantTotal} — con UP: ${mantConUp}, ` +
      `con taller asignado: ${mantConTaller}`,
  );

  // ── Usuarios (para scoping RBAC) ────────────────────────────────────
  section("Usuarios (para permisos por UP)");
  const userTotal = await prisma.usuario.count();
  const userActivos = await prisma.usuario.count({
    where: { estado: "activo" },
  });
  console.log(`Usuarios: ${userTotal} — activos: ${userActivos}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
