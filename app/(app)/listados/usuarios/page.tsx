import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect, userIdFromSession } from "@/lib/rbac";

import {
  UsuariosClient,
  type UsuarioRow,
  type RolOption,
  type UsuariosKpis,
} from "./usuarios-client";

export default async function UsuariosPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.usuarios.manage");
  const currentUserId = userIdFromSession(session);

  const [usuarios, roles] = await Promise.all([
    prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        rolId: true,
        rol: { select: { nombre: true } },
        createdAt: true,
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.rol.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rows: UsuarioRow[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email ?? null,
    estado: u.estado,
    rolId: u.rolId ?? null,
    rolNombre: u.rol?.nombre ?? null,
    createdAt: u.createdAt,
  }));

  const rolOptions: RolOption[] = roles.map((r) => ({
    id: r.id,
    nombre: r.nombre,
  }));

  const total = rows.length;
  const activos = rows.filter((r) => r.estado === "activo").length;
  const inactivos = total - activos;
  const sinRol = rows.filter((r) => r.rolId == null).length;

  const kpis: UsuariosKpis = { total, activos, inactivos, sinRol };

  return (
    <UsuariosClient
      rows={rows}
      roles={rolOptions}
      canManage={canManage}
      currentUserId={currentUserId}
      kpis={kpis}
    />
  );
}
