import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";
import { seedPermisos } from "../lib/permisos/seed";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const roles = [
    "Administrador",
    "Mecánico",
    "Electrico",
    "Metalurgico",
    "Ingeniero",
    "Mantenimiento",
    "Pañolero",
    "Recorredor",
  ];

  for (const nombre of roles) {
    await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  const adminRol = await prisma.rol.findUniqueOrThrow({
    where: { nombre: "Administrador" },
  });

  const email = "admin@cervi.local";
  const plainPassword = "cambiar123";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      nombre: "Administrador",
      email,
      passwordHash,
      rolId: adminRol.id,
    },
  });

  const { catalogUpserts, adminGrants, panoleroGrants } =
    await seedPermisos(prisma);

  console.log(
    `Seeded ${roles.length} roles and 1 admin user (${email} / ${plainPassword})`,
  );
  console.log(
    `Seeded ${catalogUpserts} permisos; +${adminGrants} admin grants, +${panoleroGrants} pañolero grants`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
