import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { prisma } from "@/lib/db";

import {
  MantenimientoDetailClient,
  type MantenimientoDetailData,
} from "./mantenimiento-detail-client";

export default async function MantenimientoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "mantenimiento.view");

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const mant = await prisma.mantenimiento.findUnique({
    where: { id },
    include: {
      maquinaria: {
        select: {
          id: true,
          nroSerie: true,
          tipo: { select: { nombre: true } },
        },
      },
      responsable: { select: { id: true, nombre: true } },
      unidadProductiva: {
        select: {
          id: true,
          nombre: true,
          localidad: { select: { nombre: true } },
        },
      },
      tallerAsignado: {
        select: {
          id: true,
          nombre: true,
          localidad: { select: { nombre: true } },
        },
      },
      insumos: {
        orderBy: { id: "asc" },
        include: {
          item: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              unidadMedida: true,
              valorUnitario: true,
              stock: true,
            },
          },
        },
      },
      tareas: {
        orderBy: [{ orden: "asc" }, { id: "asc" }],
      },
      historial: {
        orderBy: { fechaCambio: "desc" },
      },
      revisionesHijas: {
        orderBy: { fechaCreacion: "desc" },
        take: 1,
        select: {
          id: true,
          estado: true,
          fechaProgramada: true,
        },
      },
    },
  });
  if (!mant) notFound();

  const [usuarios, unidadesProductivas, inventario] = await Promise.all([
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
    prisma.inventario.findMany({
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
        valorUnitario: true,
        stock: true,
      },
      orderBy: { descripcion: "asc" },
    }),
  ]);

  const data: MantenimientoDetailData = {
    id: mant.id,
    tipo: mant.tipo,
    estado: mant.estado,
    prioridad: mant.prioridad,
    descripcion: mant.descripcion,
    fechaCreacion: mant.fechaCreacion.toISOString(),
    fechaInicio: mant.fechaInicio?.toISOString() ?? null,
    fechaFinalizacion: mant.fechaFinalizacion?.toISOString() ?? null,
    fechaProgramada: mant.fechaProgramada?.toISOString() ?? null,
    creadoPor: mant.creadoPor,
    programarRevision: mant.programarRevision,
    fechaProximaRevision: mant.fechaProximaRevision?.toISOString() ?? null,
    descripcionRevision: mant.descripcionRevision,
    maquinaria: {
      id: mant.maquinaria.id,
      label: `${mant.maquinaria.tipo.nombre} · ${mant.maquinaria.nroSerie ?? "—"}`,
    },
    responsable: {
      id: mant.responsable.id,
      nombre: mant.responsable.nombre,
    },
    unidadProductiva: mant.unidadProductiva
      ? {
          id: mant.unidadProductiva.id,
          nombre: mant.unidadProductiva.nombre,
          localidad: mant.unidadProductiva.localidad?.nombre ?? null,
        }
      : null,
    tallerAsignado: mant.tallerAsignado
      ? {
          id: mant.tallerAsignado.id,
          nombre: mant.tallerAsignado.nombre,
          localidad: mant.tallerAsignado.localidad?.nombre ?? null,
        }
      : null,
    insumos: mant.insumos.map((i) => ({
      id: i.id,
      itemInventarioId: i.itemInventarioId,
      cantidadSugerida: i.cantidadSugerida,
      cantidadUtilizada: i.cantidadUtilizada,
      unidadMedida: i.unidadMedida,
      costoUnitario: i.costoUnitario,
    })),
    tareas: mant.tareas.map((t) => ({
      id: t.id,
      descripcion: t.descripcion,
      realizada: t.realizada,
    })),
    revisionHija: mant.revisionesHijas[0]
      ? {
          id: mant.revisionesHijas[0].id,
          estado: mant.revisionesHijas[0].estado,
          fechaProgramada:
            mant.revisionesHijas[0].fechaProgramada?.toISOString() ?? null,
        }
      : null,
    historial: mant.historial.map((h) => ({
      id: h.id,
      tipoCambio: h.tipoCambio,
      valorAnterior: h.valorAnterior,
      valorNuevo: h.valorNuevo,
      detalle: h.detalle,
      fechaCambio: h.fechaCambio.toISOString(),
      usuario: h.usuario,
    })),
  };

  return (
    <MantenimientoDetailClient
      data={data}
      canUpdate={hasPermission(session, "mantenimiento.update")}
      canCancel={hasPermission(session, "mantenimiento.cancel")}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
      unidadesProductivas={unidadesProductivas.map((up) => ({
        id: up.id,
        nombre: up.nombre,
        localidad: up.localidad?.nombre ?? null,
      }))}
      inventario={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
        valorUnitario: i.valorUnitario,
        stock: i.stock,
      }))}
    />
  );
}
