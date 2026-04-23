import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  MODULO_LABELS,
  MODULO_ORDEN,
  PERMISOS_CATALOG,
  type Modulo,
} from "@/lib/permisos/catalog";

import { PermisosEditorClient, type PermisoGroup } from "./permisos-editor-client";

type Params = { id: string };

export default async function PermisosRolPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await auth();
  if (!hasPermission(session, "listados.roles.manage")) {
    redirect("/listados/roles");
  }

  const { id } = await params;
  const rolId = Number(id);
  if (!Number.isFinite(rolId)) notFound();

  const rol = await prisma.rol.findUnique({
    where: { id: rolId },
    include: {
      _count: { select: { usuarios: true } },
      permisos: { select: { permiso: { select: { codigo: true } } } },
    },
  });
  if (!rol) notFound();

  const selected = new Set(rol.permisos.map((rp) => rp.permiso.codigo));

  const groups: PermisoGroup[] = MODULO_ORDEN.map((modulo) => {
    const items = PERMISOS_CATALOG.filter((p) => p.modulo === modulo).map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      selected: selected.has(p.codigo),
    }));
    return {
      modulo,
      label: MODULO_LABELS[modulo as Modulo],
      items,
    };
  }).filter((g) => g.items.length > 0);

  return (
    <PermisosEditorClient
      rol={{ id: rol.id, nombre: rol.nombre, usuariosCount: rol._count.usuarios }}
      groups={groups}
      locked={rol.nombre === "Administrador"}
      canEdit={hasPermission(session, "listados.roles.manage")}
    />
  );
}
