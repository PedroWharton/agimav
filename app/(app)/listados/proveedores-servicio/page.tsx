import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import {
  ProveedoresServicioClient,
  type ProveedorServicioRow,
  type ProveedoresServicioKpis,
} from "./proveedores-servicio-client";

export default async function ProveedoresServicioPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.proveedores.manage");

  const proveedores = await prisma.proveedorServicio.findMany({
    select: {
      id: true,
      nombre: true,
      rubro: true,
      cuit: true,
      email: true,
      telefono: true,
      contacto: true,
      observaciones: true,
      estado: true,
      createdAt: true,
      _count: { select: { servicios: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const rows: ProveedorServicioRow[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    rubro: p.rubro ?? null,
    cuit: p.cuit ?? null,
    email: p.email ?? null,
    telefono: p.telefono ?? null,
    contacto: p.contacto ?? null,
    observaciones: p.observaciones ?? null,
    estado: p.estado,
    serviciosCount: p._count.servicios,
    createdAt: p.createdAt,
  }));

  const rubros = Array.from(
    new Set(
      rows
        .map((r) => r.rubro)
        .filter((r): r is string => !!r && r.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const kpis: ProveedoresServicioKpis = {
    total: rows.length,
    activos: rows.filter((r) => r.estado === "activo").length,
    inactivos: rows.filter((r) => r.estado === "inactivo").length,
  };

  return (
    <ProveedoresServicioClient
      rows={rows}
      rubros={rubros}
      canManage={canManage}
      kpis={kpis}
    />
  );
}
