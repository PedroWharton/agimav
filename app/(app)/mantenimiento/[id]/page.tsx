import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { canAccessUp } from "@/lib/up-scope";
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
          localidad: true,
        },
      },
      tallerAsignado: {
        select: {
          id: true,
          nombre: true,
          localidad: true,
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
      revisiones: {
        orderBy: { fechaProgramada: "asc" },
        select: {
          id: true,
          fechaProgramada: true,
          descripcion: true,
          estado: true,
          fechaRealizada: true,
        },
      },
      serviciosExternos: {
        orderBy: { id: "asc" },
        include: {
          proveedorServicio: { select: { id: true, nombre: true } },
        },
      },
    },
  });
  if (!mant) notFound();

  // WS-B3: un usuario con scoping per-UP no puede abrir el detalle de un
  // mantenimiento fuera de sus unidades asignadas.
  if (!(await canAccessUp(session, mant.unidadProductivaId))) notFound();

  const [usuarios, unidadesProductivas, inventario, proveedoresServicio] =
    await Promise.all([
      prisma.usuario.findMany({
        where: { estado: "activo" },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.unidadProductiva.findMany({
        select: {
          id: true,
          nombre: true,
          localidad: true,
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
      prisma.proveedorServicio.findMany({
        where: { estado: "activo" },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
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
          localidad: mant.unidadProductiva.localidad ?? null,
        }
      : null,
    tallerAsignado: mant.tallerAsignado
      ? {
          id: mant.tallerAsignado.id,
          nombre: mant.tallerAsignado.nombre,
          localidad: mant.tallerAsignado.localidad ?? null,
        }
      : null,
    insumos: mant.insumos.map((i) => ({
      id: i.id,
      itemInventarioId: i.itemInventarioId,
      cantidadSugerida: i.cantidadSugerida,
      cantidadUtilizada: i.cantidadUtilizada,
      unidadMedida: i.unidadMedida,
      costoUnitario: i.costoUnitario,
      precioPendiente: i.precioPendiente,
    })),
    tareas: mant.tareas.map((t) => ({
      id: t.id,
      descripcion: t.descripcion,
      realizada: t.realizada,
    })),
    revisiones: mant.revisiones.map((r) => ({
      id: r.id,
      fechaProgramada: r.fechaProgramada.toISOString(),
      descripcion: r.descripcion,
      estado: r.estado,
      fechaRealizada: r.fechaRealizada?.toISOString() ?? null,
    })),
    serviciosExternos: mant.serviciosExternos.map((s) => ({
      id: s.id,
      proveedorServicioId: s.proveedorServicioId,
      proveedorNombre: s.proveedorServicio.nombre,
      descripcion: s.descripcion,
      costo: s.costo,
      precioPendiente: s.precioPendiente,
      fecha: s.fecha?.toISOString() ?? null,
    })),
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
        localidad: up.localidad ?? null,
      }))}
      inventario={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
        valorUnitario: i.valorUnitario,
        stock: i.stock,
      }))}
      proveedoresServicio={proveedoresServicio}
    />
  );
}
