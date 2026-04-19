import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/db";

import { PlantillaDetailClient } from "./plantilla-detail-client";
import { FRECUENCIA_UNIDADES, type FrecuenciaUnidad } from "../types";

export default async function PlantillaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const plantilla = await prisma.plantillaMantenimiento.findUnique({
    where: { id },
    include: {
      insumos: {
        orderBy: { id: "asc" },
        include: {
          item: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              unidadMedida: true,
            },
          },
        },
      },
      tareas: {
        orderBy: [{ orden: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!plantilla) notFound();

  const [tipos, inventario, maquinarias, usuarios, unidadesProductivas] =
    await Promise.all([
      prisma.maquinariaTipo.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.inventario.findMany({
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          unidadMedida: true,
        },
        orderBy: { descripcion: "asc" },
      }),
      prisma.maquinaria.findMany({
        where: {
          estado: "activo",
          typeId: plantilla.tipoMaquinariaId,
        },
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

  const frecuenciaUnidad: FrecuenciaUnidad =
    (FRECUENCIA_UNIDADES as readonly string[]).includes(
      plantilla.frecuenciaUnidad,
    )
      ? (plantilla.frecuenciaUnidad as FrecuenciaUnidad)
      : "horas";

  return (
    <PlantillaDetailClient
      initial={{
        id: plantilla.id,
        nombre: plantilla.nombre,
        tipoMaquinariaId: plantilla.tipoMaquinariaId,
        frecuenciaValor: plantilla.frecuenciaValor,
        frecuenciaUnidad,
        prioridad: plantilla.prioridad,
        descripcion: plantilla.descripcion ?? "",
        insumos: plantilla.insumos.map((i) => ({
          id: i.id,
          itemInventarioId: i.itemInventarioId,
          cantidadSugerida: i.cantidadSugerida,
          unidadMedida: i.unidadMedida,
        })),
        tareas: plantilla.tareas.map((t) => ({
          id: t.id,
          descripcion: t.descripcion,
        })),
      }}
      tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre }))}
      inventario={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
      }))}
      maquinarias={maquinarias.map((m) => ({
        id: m.id,
        label: `${m.tipo.nombre} · ${m.nroSerie ?? "—"}`,
      }))}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
      unidadesProductivas={unidadesProductivas.map((up) => ({
        id: up.id,
        nombre: up.nombre,
        localidad: up.localidad?.nombre ?? null,
      }))}
      isAdmin={isAdmin(session)}
    />
  );
}
