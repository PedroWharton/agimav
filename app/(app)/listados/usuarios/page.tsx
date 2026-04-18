import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin, userIdFromSession } from "@/lib/rbac";

import { UsuariosClient, type UsuarioRow, type RolOption } from "./usuarios-client";

export default async function UsuariosPage() {
  const session = await auth();
  const admin = isAdmin(session);
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

  const rolOptions: RolOption[] = roles.map((r) => ({ id: r.id, nombre: r.nombre }));

  return (
    <UsuariosClient
      rows={rows}
      roles={rolOptions}
      isAdmin={admin}
      currentUserId={currentUserId}
    />
  );
}
