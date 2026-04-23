import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import { RolesClient, type RolRow, type RolesKpis } from "./roles-client";

export default async function RolesPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.roles.manage");

  const rows = await prisma.rol.findMany({
    select: {
      id: true,
      nombre: true,
      createdAt: true,
      _count: { select: { usuarios: true, permisos: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const roles: RolRow[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    usuariosCount: r._count.usuarios,
    permisosCount: r._count.permisos,
    createdAt: r.createdAt,
  }));

  const total = roles.length;
  const asignados = roles.filter((r) => r.usuariosCount > 0).length;
  const sinUsuarios = total - asignados;

  const kpis: RolesKpis = { total, asignados, sinUsuarios };

  return <RolesClient roles={roles} canManage={canManage} kpis={kpis} />;
}
