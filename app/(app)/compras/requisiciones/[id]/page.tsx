import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin, userNameFromSession } from "@/lib/rbac";

import { RequisicionForm } from "../requisicion-form";
import type { DetalleLine } from "@/components/compras/detalle-lines-editor";

export default async function RequisicionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const [requisicion, inventario, unidades, localidades, usuarios] =
    await Promise.all([
      prisma.requisicion.findUnique({
        where: { id },
        include: {
          detalle: {
            orderBy: { id: "asc" },
            include: {
              ocDetalle: {
                include: {
                  oc: {
                    select: {
                      id: true,
                      numeroOc: true,
                      estado: true,
                      proveedor: { select: { nombre: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.inventario.findMany({
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          unidadMedida: true,
        },
        orderBy: [{ codigo: "asc" }, { descripcion: "asc" }],
      }),
      prisma.unidadProductiva.findMany({
        select: { nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.localidad.findMany({
        select: { nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.usuario.findMany({
        where: { estado: "activo" },
        select: { nombre: true },
        orderBy: { nombre: "asc" },
      }),
    ]);

  if (!requisicion) notFound();

  const currentUserName = userNameFromSession(session);
  const admin = isAdmin(session);
  const isOwner =
    !!currentUserName &&
    !!requisicion.creadoPor &&
    currentUserName === requisicion.creadoPor;
  const canMutate =
    requisicion.estado === "Borrador" && (admin || isOwner);
  const canApprove = admin && requisicion.estado === "En Revisión";

  const ocMap = new Map<
    number,
    { id: number; numeroOc: string | null; proveedor: string; estado: string }
  >();
  for (const d of requisicion.detalle) {
    for (const od of d.ocDetalle) {
      if (!ocMap.has(od.oc.id)) {
        ocMap.set(od.oc.id, {
          id: od.oc.id,
          numeroOc: od.oc.numeroOc,
          proveedor: od.oc.proveedor.nombre,
          estado: od.oc.estado,
        });
      }
    }
  }
  const ocsVinculadas = Array.from(ocMap.values()).sort(
    (a, b) => a.id - b.id,
  );

  const detalle: DetalleLine[] = requisicion.detalle.map((d) => ({
    key: `line-${d.id}`,
    id: d.id,
    itemId: d.itemId,
    cantidad: d.cantidad,
    prioridadItem: d.prioridadItem === "Urgente" ? "Urgente" : "Normal",
    notasItem: d.notasItem ?? "",
  }));

  return (
    <RequisicionForm
      mode="edit"
      initial={{
        id: requisicion.id,
        fechaCreacion: requisicion.fechaCreacion.toISOString(),
        solicitante: requisicion.solicitante,
        unidadProductiva: requisicion.unidadProductiva,
        localidad: requisicion.localidad,
        prioridad: requisicion.prioridad,
        estado: requisicion.estado,
        fechaTentativa: requisicion.fechaTentativa?.toISOString() ?? null,
        fechaLimite: requisicion.fechaLimite?.toISOString() ?? null,
        notas: requisicion.notas,
        creadoPor: requisicion.creadoPor,
        fechaAprobacion: requisicion.fechaAprobacion?.toISOString() ?? null,
        aprobadoPor: requisicion.aprobadoPor,
        fechaCancelacion:
          requisicion.fechaCancelacion?.toISOString() ?? null,
        canceladoPor: requisicion.canceladoPor,
        motivoRechazo: requisicion.motivoRechazo,
        detalle,
        ocsVinculadas,
      }}
      inventarioOptions={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo ?? "",
        descripcion: i.descripcion ?? "",
        unidadMedida: i.unidadMedida,
      }))}
      unidadesProductivas={unidades.map((u) => u.nombre)}
      localidades={localidades.map((l) => l.nombre)}
      usuariosSolicitantes={usuarios.map((u) => u.nombre)}
      currentUserName={currentUserName}
      canMutate={canMutate}
      canApprove={canApprove}
    />
  );
}
