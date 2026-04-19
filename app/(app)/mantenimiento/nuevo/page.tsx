import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { MantenimientoFormClient } from "./mantenimiento-form-client";

export default async function NuevoMantenimientoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [maquinarias, usuarios, unidadesProductivas] = await Promise.all([
    prisma.maquinaria.findMany({
      where: { estado: "activo" },
      select: {
        id: true,
        nroSerie: true,
        tipo: { select: { nombre: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.usuario.findMany({
      where: { estado: "activo" },
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

  if (maquinarias.length === 0) notFound();

  return (
    <MantenimientoFormClient
      maquinarias={maquinarias.map((m) => ({
        id: m.id,
        tipoNombre: m.tipo.nombre,
        nroSerie: m.nroSerie ?? "—",
        principal: null,
      }))}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
      unidadesProductivas={unidadesProductivas.map((up) => ({
        id: up.id,
        nombre: up.nombre,
        localidad: up.localidad?.nombre ?? null,
      }))}
    />
  );
}
