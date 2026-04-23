import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import { OtForm } from "../ot-form";

export default async function NuevaOtPage() {
  const session = await auth();
  requireViewOrRedirect(session, "ot.view");
  if (!hasPermission(session, "ot.create")) {
    redirect("/ordenes-trabajo");
  }

  const [usuarios, localidades, unidadesProductivas] = await Promise.all([
    prisma.usuario.findMany({
      where: { estado: "activo" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.localidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.unidadProductiva.findMany({
      select: {
        id: true,
        nombre: true,
        localidad: { select: { nombre: true } },
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <OtForm
      mode="new"
      initial={{
        titulo: "",
        descripcionTrabajo: "",
        localidadId: null,
        unidadProductivaId: null,
        solicitanteId: null,
        responsableId: null,
        prioridad: "Media",
        observaciones: "",
      }}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
      localidades={localidades.map((l) => ({ id: l.id, nombre: l.nombre }))}
      unidadesProductivas={unidadesProductivas.map((up) => ({
        id: up.id,
        nombre: up.nombre,
        localidad: up.localidad?.nombre ?? null,
      }))}
    />
  );
}
