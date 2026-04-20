import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { MantenimientoFormClient } from "./mantenimiento-form-client";

export const dynamic = "force-dynamic";

export default async function NuevoMantenimientoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [maquinarias, usuarios, unidadesProductivas, plantillas, insumos] =
    await Promise.all([
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
      prisma.plantillaMantenimiento.findMany({
        select: {
          id: true,
          nombre: true,
          tipoMaquinaria: { select: { nombre: true } },
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.inventario.findMany({
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          stock: true,
          unidadMedida: true,
          valorUnitario: true,
        },
        orderBy: { descripcion: "asc" },
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
      plantillas={plantillas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tipoMaquinaria: p.tipoMaquinaria.nombre,
      }))}
      insumos={insumos.map((i) => ({
        id: i.id,
        sku: i.codigo ?? `#${i.id}`,
        nombre: i.descripcion ?? "—",
        stock: i.stock,
        unidadMedida: i.unidadMedida ?? "",
        unitCost: i.valorUnitario,
      }))}
    />
  );
}
