import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { MantenimientoFormClient } from "./mantenimiento-form-client";

export const dynamic = "force-dynamic";

export default async function NuevoMantenimientoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const rawMaquinariaId = Array.isArray(sp.maquinariaId)
    ? sp.maquinariaId[0]
    : sp.maquinariaId;
  const initialMaquinariaId = rawMaquinariaId
    ? Number.parseInt(rawMaquinariaId, 10)
    : null;
  const validInitialMaquinariaId =
    initialMaquinariaId != null && Number.isFinite(initialMaquinariaId)
      ? initialMaquinariaId
      : null;

  const [maquinarias, usuarios, unidadesProductivas, plantillas, insumos] =
    await Promise.all([
      prisma.maquinaria.findMany({
        where: { estado: "activo" },
        select: {
          id: true,
          nroSerie: true,
          tipo: { select: { id: true, nombre: true } },
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
          descripcion: true,
          prioridad: true,
          frecuenciaValor: true,
          frecuenciaUnidad: true,
          tipoMaquinariaId: true,
          tipoMaquinaria: { select: { nombre: true } },
          insumos: {
            select: {
              itemInventarioId: true,
              cantidadSugerida: true,
              unidadMedida: true,
              item: {
                select: {
                  codigo: true,
                  descripcion: true,
                  stock: true,
                  valorUnitario: true,
                  unidadMedida: true,
                },
              },
            },
          },
          _count: { select: { tareas: true } },
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
        tipoId: m.tipo.id,
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
        tipoMaquinariaId: p.tipoMaquinariaId,
        tipoMaquinaria: p.tipoMaquinaria.nombre,
        descripcion: p.descripcion,
        prioridad: p.prioridad,
        frecuenciaValor: p.frecuenciaValor,
        frecuenciaUnidad: p.frecuenciaUnidad,
        tareasCount: p._count.tareas,
        insumos: p.insumos.map((i) => ({
          itemInventarioId: i.itemInventarioId,
          sku: i.item.codigo ?? `#${i.itemInventarioId}`,
          nombre: i.item.descripcion ?? "—",
          stock: i.item.stock,
          unidadMedida:
            i.unidadMedida || (i.item.unidadMedida ?? ""),
          unitCost: i.item.valorUnitario,
          cantidadSugerida: i.cantidadSugerida,
        })),
      }))}
      insumos={insumos.map((i) => ({
        id: i.id,
        sku: i.codigo ?? `#${i.id}`,
        nombre: i.descripcion ?? "—",
        stock: i.stock,
        unidadMedida: i.unidadMedida ?? "",
        unitCost: i.valorUnitario,
      }))}
      initialMaquinariaId={
        validInitialMaquinariaId != null &&
        maquinarias.some((m) => m.id === validInitialMaquinariaId)
          ? validInitialMaquinariaId
          : null
      }
    />
  );
}
