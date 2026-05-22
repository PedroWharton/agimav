import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ADMIN_ALL } from "@/lib/permisos/catalog";

import { UnidadesEditorClient, type UpItem } from "./unidades-editor-client";

type Params = { id: string };

export default async function UsuarioUnidadesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await auth();
  if (!hasPermission(session, "listados.usuarios.manage")) {
    redirect("/listados/usuarios");
  }

  const { id } = await params;
  const usuarioId = Number(id);
  if (!Number.isFinite(usuarioId)) notFound();

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nombre: true,
      rolId: true,
      unidadesProductivasAsignadas: { select: { unidadProductivaId: true } },
    },
  });
  if (!usuario) notFound();

  const [unidades, adminRolPermiso] = await Promise.all([
    prisma.unidadProductiva.findMany({
      select: { id: true, nombre: true, localidad: true },
      orderBy: [{ localidad: "asc" }, { nombre: "asc" }],
    }),
    usuario.rolId != null
      ? prisma.rolPermiso.findFirst({
          where: { rolId: usuario.rolId, permiso: { codigo: ADMIN_ALL } },
          select: { rolId: true },
        })
      : Promise.resolve(null),
  ]);

  const asignadas = new Set(
    usuario.unidadesProductivasAsignadas.map((a) => a.unidadProductivaId),
  );
  const items: UpItem[] = unidades.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    localidad: u.localidad,
    selected: asignadas.has(u.id),
  }));

  return (
    <UnidadesEditorClient
      usuario={{
        id: usuario.id,
        nombre: usuario.nombre,
        esAdmin: adminRolPermiso != null,
      }}
      items={items}
    />
  );
}
