import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { OtDetailClient } from "./ot-detail-client";
import { OT_PRIORIDADES, type OtPrioridad } from "../actions";

export default async function OtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id },
    include: {
      solicitante: { select: { id: true, nombre: true } },
      responsable: { select: { id: true, nombre: true } },
      localidad: { select: { id: true, nombre: true } },
      unidadProductiva: {
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
              stock: true,
              valorUnitario: true,
            },
          },
        },
      },
    },
  });
  if (!ot) notFound();

  const [usuarios, localidades, unidadesProductivas, inventario] =
    await Promise.all([
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

  const prioridad: OtPrioridad =
    (OT_PRIORIDADES as readonly string[]).includes(ot.prioridad)
      ? (ot.prioridad as OtPrioridad)
      : "Media";

  return (
    <OtDetailClient
      ot={{
        id: ot.id,
        numeroOt: ot.numeroOt,
        titulo: ot.titulo,
        descripcionTrabajo: ot.descripcionTrabajo ?? "",
        observaciones: ot.observaciones ?? "",
        estado: ot.estado,
        prioridad,
        fechaCreacion: ot.fechaCreacion.toISOString(),
        fechaFinalizacion: ot.fechaFinalizacion
          ? ot.fechaFinalizacion.toISOString()
          : null,
        creadoPor: ot.creadoPor,
        solicitanteId: ot.solicitante?.id ?? null,
        responsableId: ot.responsable?.id ?? null,
        localidadId: ot.localidad?.id ?? null,
        unidadProductivaId: ot.unidadProductiva?.id ?? null,
        insumos: ot.insumos.map((i) => ({
          id: i.id,
          itemInventarioId: i.itemInventarioId,
          itemCodigo: i.item.codigo,
          itemDescripcion: i.item.descripcion,
          cantidad: i.cantidad,
          unidadMedida: i.unidadMedida ?? i.item.unidadMedida,
          costoUnitario: i.costoUnitario,
          costoTotal: i.costoTotal,
          stockDisponible: i.item.stock,
        })),
      }}
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
      localidades={localidades.map((l) => ({ id: l.id, nombre: l.nombre }))}
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
