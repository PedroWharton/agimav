import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { getLocalidadesSugeridas } from "@/lib/localidades";

import { OtForm } from "../ot-form";

export default async function NuevaOtPage() {
  const session = await auth();
  requireViewOrRedirect(session, "ot.view");
  if (!hasPermission(session, "ot.create")) {
    redirect("/ordenes-trabajo");
  }

  const [usuarios, localidades, unidadesProductivas, categorias] =
    await Promise.all([
      prisma.usuario.findMany({
        where: { estado: "activo" },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      getLocalidadesSugeridas(),
      prisma.unidadProductiva.findMany({
        select: {
          id: true,
          nombre: true,
          localidad: true,
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.categoriaOt.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
    ]);

  return (
    <OtForm
      mode="new"
      initial={{
        titulo: "",
        descripcionTrabajo: "",
        localidad: "",
        unidadProductivaId: null,
        solicitanteId: null,
        responsableId: null,
        prioridad: "Media",
        observaciones: "",
        categoriaId: null,
        fechaProgramada: null,
        duracionDias: null,
      }}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
      localidades={localidades}
      unidadesProductivas={unidadesProductivas.map((up) => ({
        id: up.id,
        nombre: up.nombre,
        localidad: up.localidad ?? null,
      }))}
      categorias={categorias}
    />
  );
}
