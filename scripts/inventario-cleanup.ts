/**
 * One-off whitespace + empty-string cleanup for the inventario catalog.
 *
 * Data debt inherited from flota7.db:
 *  - Leading/trailing whitespace on codigo, descripcion, categoria.
 *  - Empty strings in localidad, unidadProductiva, unidadMedida that should be NULL.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   pnpm db:cleanup-inventario              # preview only
 *   pnpm db:cleanup-inventario -- --apply   # actually write
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const apply = process.argv.includes("--apply");

type Item = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  categoria: string | null;
  localidad: string | null;
  unidadProductiva: string | null;
  unidadMedida: string | null;
};

type Change = {
  id: number;
  field: string;
  from: string | null;
  to: string | null;
};

function emptyToNull(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function trimmedOrNull(v: string | null): string | null {
  if (v === null) return null;
  return v.trim();
}

function clean(item: Item): { changes: Change[]; next: Partial<Item> } {
  const changes: Change[] = [];
  const next: Partial<Item> = {};

  const codigoTrim = trimmedOrNull(item.codigo);
  if (codigoTrim !== item.codigo && codigoTrim !== "" && codigoTrim !== null) {
    changes.push({ id: item.id, field: "codigo", from: item.codigo, to: codigoTrim });
    next.codigo = codigoTrim;
  }

  const descTrim = trimmedOrNull(item.descripcion);
  if (descTrim !== item.descripcion && descTrim !== "" && descTrim !== null) {
    changes.push({
      id: item.id,
      field: "descripcion",
      from: item.descripcion,
      to: descTrim,
    });
    next.descripcion = descTrim;
  }

  const catTrim = trimmedOrNull(item.categoria);
  if (catTrim !== item.categoria) {
    const target = catTrim === "" ? null : catTrim;
    changes.push({
      id: item.id,
      field: "categoria",
      from: item.categoria,
      to: target,
    });
    next.categoria = target;
  }

  const locClean = emptyToNull(item.localidad);
  if (locClean !== item.localidad) {
    changes.push({
      id: item.id,
      field: "localidad",
      from: item.localidad,
      to: locClean,
    });
    next.localidad = locClean;
  }

  const upClean = emptyToNull(item.unidadProductiva);
  if (upClean !== item.unidadProductiva) {
    changes.push({
      id: item.id,
      field: "unidadProductiva",
      from: item.unidadProductiva,
      to: upClean,
    });
    next.unidadProductiva = upClean;
  }

  const umClean = emptyToNull(item.unidadMedida);
  if (umClean !== item.unidadMedida) {
    changes.push({
      id: item.id,
      field: "unidadMedida",
      from: item.unidadMedida,
      to: umClean,
    });
    next.unidadMedida = umClean;
  }

  return { changes, next };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing. Run with --env-file=.env.local.");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const items = await prisma.inventario.findMany({
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      categoria: true,
      localidad: true,
      unidadProductiva: true,
      unidadMedida: true,
    },
  });

  const existingCodigos = new Set<string>();
  for (const it of items) {
    if (it.codigo !== null) existingCodigos.add(it.codigo);
  }

  const allChanges: Change[] = [];
  const updates: { id: number; data: Partial<Item> }[] = [];
  const codigoConflicts: { id: number; from: string; to: string }[] = [];

  for (const item of items) {
    const { changes, next } = clean(item);
    if (
      next.codigo !== undefined &&
      next.codigo !== null &&
      existingCodigos.has(next.codigo)
    ) {
      codigoConflicts.push({
        id: item.id,
        from: item.codigo ?? "",
        to: next.codigo,
      });
      delete next.codigo;
      const filtered = changes.filter((c) => c.field !== "codigo");
      if (filtered.length > 0) {
        allChanges.push(...filtered);
        updates.push({ id: item.id, data: next });
      }
      continue;
    }
    if (changes.length > 0) {
      allChanges.push(...changes);
      updates.push({ id: item.id, data: next });
    }
  }

  console.log(`\nScanned ${items.length} items.`);
  console.log(`Rows with cleanup: ${updates.length}`);
  const perField = new Map<string, number>();
  for (const c of allChanges) perField.set(c.field, (perField.get(c.field) ?? 0) + 1);
  for (const [field, count] of perField.entries()) {
    console.log(`  ${field}: ${count}`);
  }

  if (allChanges.length > 0) {
    console.log("\nSample (first 20 changes):");
    for (const c of allChanges.slice(0, 20)) {
      console.log(
        `  #${c.id} ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`,
      );
    }
  }

  if (codigoConflicts.length > 0) {
    console.log(
      `\n[skipped] ${codigoConflicts.length} codigo trims would collide with an existing codigo:`,
    );
    for (const c of codigoConflicts) {
      console.log(`  #${c.id} ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
    }
    console.log("  These rows keep their original codigo. Review manually.");
  }

  if (!apply) {
    console.log("\n[dry-run] No changes written. Re-run with --apply to commit.");
    await prisma.$disconnect();
    return;
  }

  if (updates.length === 0) {
    console.log("\nNothing to apply.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nApplying ${updates.length} updates (sequential)…`);
  let done = 0;
  for (const { id, data } of updates) {
    await prisma.inventario.update({ where: { id }, data });
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${updates.length}`);
  }
  console.log(`Done. ${done}/${updates.length} applied.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
