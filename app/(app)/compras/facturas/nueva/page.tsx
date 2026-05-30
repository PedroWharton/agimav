import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

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
  searchParams: Promise<{ proveedorId?: string; oc?: string; ocs?: string }>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "compras.view");
  if (!hasPermission(session, "compras.factura.create")) {
    redirect("/compras/facturas");
  }

  const { proveedorId: rawPid, oc: rawOc, ocs: rawOcs } = await searchParams;

  const singleOcParam = rawOc ? Number.parseInt(rawOc, 10) : null;
  const singleOcId =
    singleOcParam && Number.isFinite(singleOcParam) ? singleOcParam : null;

  const multiOcIds = (rawOcs ?? "")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  // Set of OCs this factura is restricted to: either a single `?oc=` or a
  // multi `?ocs=1,2,3` selection from the pendientes tab. Empty = pick proveedor
  // freely and load all its unbilled lines.
  const ocIds =
    multiOcIds.length > 0 ? multiOcIds : singleOcId != null ? [singleOcId] : [];

  // Derive proveedor from the selected OCs and (for a single OC) build the
  // match-banner context. With several OCs there is no single OC total to
  // compare against, so the banner is suppressed.
  let ocContext: OcLinkContext | null = null;
  let derivedProveedorId: number | null = null;

  if (ocIds.length > 0) {
    const ocsRows = await prisma.ordenCompra.findMany({
      where: { id: { in: ocIds } },
      select: {
        id: true,
        numeroOc: true,
        proveedorId: true,
        totalEstimado: true,
      },
    });
    if (ocsRows.length > 0) {
      derivedProveedorId = ocsRows[0].proveedorId;
      if (ocsRows.length === 1) {
        const oc = ocsRows[0];
        ocContext = {
          id: oc.id,
          numero: oc.numeroOc ?? `OC-${oc.id}`,
          total: oc.totalEstimado,
        };
      }
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
            ...(ocIds.length > 0 ? { id: { in: ocIds } } : {}),
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
      preselectAll={ocIds.length > 0}
    />
  );
}
