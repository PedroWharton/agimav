import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import { RolesClient, type RolRow } from "./roles-client";

export default async function RolesPage() {
  const session = await auth();
  const admin = isAdmin(session);

  const rows = await prisma.rol.findMany({
    select: {
      id: true,
      nombre: true,
      createdAt: true,
      _count: { select: { usuarios: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const roles: RolRow[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    usuariosCount: r._count.usuarios,
    createdAt: r.createdAt,
  }));

  return <RolesClient roles={roles} isAdmin={admin} />;
}
