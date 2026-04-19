/**
 * Read-only row-count parity check between flota7.db (SQLite) and the
 * configured Postgres DATABASE_URL. Exits 0 if every table matches; non-zero
 * with a diff table otherwise. Does not write.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/parity-check.ts [path/to/flota7.db]
 */

import fs from "node:fs";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const SQLITE_PATH =
  process.argv[2] ??
  path.resolve(
    process.cwd(),
    "..",
    "..",
    "desktop",
    "proyectos",
    "agimav",
    "flota7.db",
  );

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`✗ SQLite DB not found at ${SQLITE_PATH}`);
  process.exit(1);
}

console.log(`• Source: ${SQLITE_PATH}`);
console.log(
  `• Target: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(DATABASE_URL unset)"}\n`,
);

const TABLES = [
  "roles",
  "usuarios",
  "unidades_medida",
  "localidades",
  "tipos_unidad",
  "unidades_productivas",
  "proveedores",
  "inventario",
  "inventario_movimientos",
  "movimientos_diarios",
  "maquinaria_tipos",
  "tipo_niveles",
  "nivel_atributos",
  "maquinaria",
  "maquina_nodos",
  "maquina_atributos_valores",
  "registro_horas_maquinaria",
  "tabla_config",
  "requisiciones",
  "requisiciones_detalle",
  "ordenes_compra",
  "ordenes_compra_detalle",
  "recepciones",
  "recepciones_detalle",
  "facturas",
  "factura_detalle",
  "precios_historico",
  "dolar_cotizaciones",
  "plantillas_mantenimiento",
  "plantilla_insumos",
  "plantilla_tareas",
  "mantenimientos",
  "mantenimiento_insumos",
  "mantenimiento_tareas",
  "mantenimiento_historial",
  "ordenes_trabajo",
  "ot_insumos",
];

const sqlite = new BetterSqlite3(SQLITE_PATH, { readonly: true });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  let mismatches = 0;
  let missing = 0;
  console.log(
    `  ${"table".padEnd(28)}  ${"sqlite".padStart(7)}  ${"postgres".padStart(8)}  status`,
  );
  console.log(`  ${"-".repeat(28)}  ${"-".repeat(7)}  ${"-".repeat(8)}  ------`);

  for (const table of TABLES) {
    let src = 0;
    try {
      src = (
        sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
          n: number;
        }
      ).n;
    } catch {
      console.log(`  ${table.padEnd(28)}  ${"—".padStart(7)}  ${"".padStart(8)}  not in sqlite`);
      continue;
    }

    let dst: number | null = null;
    try {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM "${table}"`,
      )) as Array<{ n: number }>;
      dst = rows[0]?.n ?? 0;
    } catch (e) {
      console.log(
        `  ${table.padEnd(28)}  ${String(src).padStart(7)}  ${"err".padStart(8)}  ✗ ${(e as Error).message.split("\n")[0]}`,
      );
      missing++;
      continue;
    }

    const ok = src === dst;
    if (!ok) mismatches++;
    console.log(
      `  ${table.padEnd(28)}  ${String(src).padStart(7)}  ${String(dst).padStart(8)}  ${ok ? "✓" : "✗ diff=" + (dst - src)}`,
    );
  }

  console.log("");
  if (mismatches === 0 && missing === 0) {
    console.log("✓ All tables match.");
  } else {
    console.error(
      `✗ ${mismatches} mismatch(es), ${missing} table(s) missing in Postgres.`,
    );
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
