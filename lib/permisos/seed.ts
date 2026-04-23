// Idempotent seed logic for the permisos catalog. Called from both
// `prisma/seed.ts` (local dev) and `scripts/migrate-from-sqlite.ts` (migration
// day). Never revokes — once admins start editing, the seed leaves their
// choices alone. Only adds:
//   1. Upserts every row in PERMISOS_CATALOG into the `permisos` table.
//   2. Grants `admin.all` to the `Administrador` rol if it exists.
//   3. Grants PANOLERO_BASELINE to the `Pañolero` rol if it exists.

import type { PrismaClient } from "../generated/prisma/client";

import {
  ADMIN_ALL,
  PANOLERO_BASELINE,
  PERMISOS_CATALOG,
  type PermisoCodigo,
} from "./catalog";

export async function seedPermisos(prisma: PrismaClient): Promise<{
  catalogUpserts: number;
  adminGrants: number;
  panoleroGrants: number;
}> {
  // 1. Upsert catalog rows.
  for (const def of PERMISOS_CATALOG) {
    await prisma.permiso.upsert({
      where: { codigo: def.codigo },
      update: { modulo: def.modulo, descripcion: def.descripcion },
      create: def,
    });
  }

  const catalogUpserts = PERMISOS_CATALOG.length;

  // 2. Grant admin.all to Administrador.
  const adminGrants = await grantByRolName(prisma, "Administrador", [ADMIN_ALL]);

  // 3. Grant baseline to Pañolero (if present).
  const panoleroGrants = await grantByRolName(prisma, "Pañolero", PANOLERO_BASELINE);

  return { catalogUpserts, adminGrants, panoleroGrants };
}

async function grantByRolName(
  prisma: PrismaClient,
  rolNombre: string,
  codigos: PermisoCodigo[],
): Promise<number> {
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  if (!rol) return 0;

  const permisos = await prisma.permiso.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true },
  });

  let granted = 0;
  for (const p of permisos) {
    const result = await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: rol.id, permisoId: p.id } },
      update: {},
      create: { rolId: rol.id, permisoId: p.id },
    });
    // upsert returns the row either way; count as granted only if the row
    // was new (createdAt within the last 2 seconds).
    if (Date.now() - result.createdAt.getTime() < 2000) granted++;
  }
  return granted;
}
