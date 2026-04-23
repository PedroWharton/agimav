/**
 * Prod-safe seed of the permisos catalog + baseline grants.
 *
 * Idempotent. Never creates users or touches roles beyond granting permisos.
 * Safe to run against production — unlike `prisma/seed.ts` which also creates
 * the dev `admin@cervi.local` user.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-permisos.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";
import { seedPermisos } from "../lib/permisos/seed";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const before = await prisma.permiso.count();
    console.log(`Before: ${before} permiso rows in DB`);

    const { catalogUpserts, adminGrants, panoleroGrants } =
      await seedPermisos(prisma);

    const after = await prisma.permiso.count();
    console.log(
      `After: ${after} permiso rows · catalog=${catalogUpserts} upserted · ` +
        `admin+=${adminGrants} · pañolero+=${panoleroGrants}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
