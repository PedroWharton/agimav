import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import {
  ProveedoresClient,
  type ProveedorRow,
  type LocalidadOption,
  type ProveedoresKpis,
} from "./proveedores-client";

export default async function ProveedoresPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.proveedores.manage");

  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const [proveedores, localidades, totalCount, activosCount, inactivosCount, nuevos30dCount] =
    await Promise.all([
      prisma.proveedor.findMany({
        select: {
          id: true,
          nombre: true,
          cuit: true,
          email: true,
          telefono: true,
          direccion: true,
          direccionFiscal: true,
          condicionIva: true,
          nombreContacto: true,
          contacto: true,
          estado: true,
          localidadId: true,
          localidad: { select: { nombre: true } },
          createdAt: true,
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.localidad.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.proveedor.count(),
      prisma.proveedor.count({ where: { estado: "activo" } }),
      prisma.proveedor.count({ where: { estado: "inactivo" } }),
      prisma.proveedor.count({ where: { createdAt: { gte: since30d } } }),
    ]);

  const rows: ProveedorRow[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    cuit: p.cuit ?? null,
    email: p.email ?? null,
    telefono: p.telefono ?? null,
    direccion: p.direccion ?? null,
    direccionFiscal: p.direccionFiscal ?? null,
    condicionIva: p.condicionIva ?? null,
    nombreContacto: p.nombreContacto ?? null,
    contacto: p.contacto ?? null,
    estado: p.estado,
    localidadId: p.localidadId ?? null,
    localidadNombre: p.localidad?.nombre ?? null,
    createdAt: p.createdAt,
  }));

  const localidadOptions: LocalidadOption[] = localidades.map((l) => ({
    id: l.id,
    nombre: l.nombre,
  }));

  const kpis: ProveedoresKpis = {
    total: totalCount,
    activos: activosCount,
    inactivos: inactivosCount,
    nuevos30d: nuevos30dCount,
    since30dIso: since30d.toISOString(),
  };

  return (
    <ProveedoresClient
      rows={rows}
      localidades={localidadOptions}
      canManage={canManage}
      kpis={kpis}
    />
  );
}
