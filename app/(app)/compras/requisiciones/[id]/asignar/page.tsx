import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import {
  AsignarClient,
  type AsignarLinea,
  type AsignarProveedorOption,
} from "./asignar-client";

export default async function AsignarProveedoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session)) redirect("/compras/requisiciones");

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const [requisicion, proveedores] = await Promise.all([
    prisma.requisicion.findUnique({
      where: { id },
      include: {
        detalle: {
          orderBy: { id: "asc" },
          include: {
            item: {
              select: {
                codigo: true,
                descripcion: true,
                unidadMedida: true,
              },
            },
          },
        },
      },
    }),
    prisma.proveedor.findMany({
      where: { estado: "activo" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!requisicion) notFound();
  if (
    requisicion.estado !== "Aprobada" &&
    requisicion.estado !== "Asignado a Proveedor"
  ) {
    redirect(`/compras/requisiciones/${id}`);
  }

  const lineas: AsignarLinea[] = requisicion.detalle.map((d, idx) => ({
    id: d.id,
    orden: idx + 1,
    itemCodigo: d.item.codigo ?? "",
    itemDescripcion: d.item.descripcion ?? "",
    cantidad: d.cantidad,
    unidadMedida: d.item.unidadMedida,
    proveedorAsignadoId: d.proveedorAsignadoId,
  }));

  const proveedorOptions: AsignarProveedorOption[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
  }));

  return (
    <AsignarClient
      requisicionId={id}
      lineas={lineas}
      proveedores={proveedorOptions}
      canMutate
    />
  );
}
