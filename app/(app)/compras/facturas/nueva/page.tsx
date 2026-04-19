import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import {
  FacturaFormClient,
  type FacturaProveedorOption,
  type FacturaRecepcionLinea,
} from "./factura-form-client";

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedorId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session)) redirect("/compras/facturas");

  const { proveedorId: rawPid } = await searchParams;
  const proveedorId = rawPid ? Number.parseInt(rawPid, 10) : null;

  const proveedores = await prisma.proveedor.findMany({
    where: { estado: "activo" },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  let unfacturadas: FacturaRecepcionLinea[] = [];
  if (proveedorId && Number.isFinite(proveedorId)) {
    const recepciones = await prisma.recepcionDetalle.findMany({
      where: {
        facturado: false,
        recepcion: { cerradaSinFactura: false },
        ocDetalle: { oc: { proveedorId } },
      },
      orderBy: [{ recepcion: { fechaRecepcion: "asc" } }, { id: "asc" }],
      include: {
        recepcion: {
          select: {
            id: true,
            numeroRemito: true,
            fechaRecepcion: true,
          },
        },
        ocDetalle: {
          include: {
            oc: { select: { id: true, numeroOc: true } },
            requisicionDetalle: {
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
          },
        },
      },
    });

    unfacturadas = recepciones.map((r) => ({
      id: r.id,
      cantidad: r.cantidadRecibida,
      remito: r.recepcion.numeroRemito,
      recepcionId: r.recepcion.id,
      fechaRecepcion: r.recepcion.fechaRecepcion.toISOString(),
      ocId: r.ocDetalle.oc.id,
      ocNumero: r.ocDetalle.oc.numeroOc ?? `#${r.ocDetalle.oc.id}`,
      itemId: r.ocDetalle.requisicionDetalle.item.id,
      itemCodigo: r.ocDetalle.requisicionDetalle.item.codigo ?? "",
      itemDescripcion: r.ocDetalle.requisicionDetalle.item.descripcion ?? "",
      unidadMedida: r.ocDetalle.requisicionDetalle.item.unidadMedida,
      ocPrecioUnitario: r.ocDetalle.precioUnitario,
    }));
  }

  const proveedorOptions: FacturaProveedorOption[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
  }));

  return (
    <FacturaFormClient
      proveedores={proveedorOptions}
      initialProveedorId={
        proveedorId && Number.isFinite(proveedorId) ? proveedorId : null
      }
      lineas={unfacturadas}
    />
  );
}
