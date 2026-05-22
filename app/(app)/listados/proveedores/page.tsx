import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { getLocalidadesSugeridas } from "@/lib/localidades";

import {
  ProveedoresClient,
  type ProveedorRow,
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
          localidad: true,
          createdAt: true,
        },
        orderBy: { nombre: "asc" },
      }),
      getLocalidadesSugeridas(),
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
    localidad: p.localidad ?? null,
    createdAt: p.createdAt,
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
      localidades={localidades}
      canManage={canManage}
      kpis={kpis}
    />
  );
}
