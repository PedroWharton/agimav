import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import {
  FacturaFormClient,
  type FacturaProveedorOption,
  type FacturaRecepcionLinea,
  type OcLinkContext,
} from "./factura-form-client";

export const dynamic = "force-dynamic";

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedorId?: string; oc?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session)) redirect("/compras/facturas");

  const { proveedorId: rawPid, oc: rawOc } = await searchParams;
  const ocIdParam = rawOc ? Number.parseInt(rawOc, 10) : null;
  const ocId = ocIdParam && Number.isFinite(ocIdParam) ? ocIdParam : null;

  // If an OC was passed, derive the proveedor from it and restrict the
  // pre-populated lines to that OC's unbilled recepciones.
  let ocContext: OcLinkContext | null = null;
  let derivedProveedorId: number | null = null;

  if (ocId) {
    const oc = await prisma.ordenCompra.findUnique({
      where: { id: ocId },
      select: {
        id: true,
        numeroOc: true,
        proveedorId: true,
        totalEstimado: true,
      },
    });
    if (oc) {
      derivedProveedorId = oc.proveedorId;
      ocContext = {
        id: oc.id,
        numero: oc.numeroOc ?? `OC-${oc.id}`,
        total: oc.totalEstimado,
      };
    }
  }

  const rawPidNumber = rawPid ? Number.parseInt(rawPid, 10) : null;
  const proveedorId =
    derivedProveedorId ??
    (rawPidNumber && Number.isFinite(rawPidNumber) ? rawPidNumber : null);

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
        ocDetalle: {
          oc: {
            proveedorId,
            ...(ocId ? { id: ocId } : {}),
          },
        },
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
      ocDetalleId: r.ocDetalle.id,
      ocId: r.ocDetalle.oc.id,
      ocNumero: r.ocDetalle.oc.numeroOc ?? `OC-${r.ocDetalle.oc.id}`,
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
      initialProveedorId={proveedorId}
      lineas={unfacturadas}
      ocContext={ocContext}
    />
  );
}
