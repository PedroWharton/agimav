import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import {
  LocalidadesClient,
  type LocalidadRow,
  type LocalidadesKpis,
} from "./localidades-client";

export default async function LocalidadesPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.master_data.manage");

  const rows = await prisma.localidad.findMany({
    select: {
      id: true,
      nombre: true,
      createdAt: true,
      _count: {
        select: {
          unidadesProductivas: true,
          proveedores: true,
          ordenesTrabajo: true,
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const data: LocalidadRow[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    createdAt: r.createdAt,
    usageCount:
      r._count.unidadesProductivas + r._count.proveedores + r._count.ordenesTrabajo,
  }));

  const total = data.length;
  const enUso = data.filter((r) => r.usageCount > 0).length;
  const sinUso = total - enUso;

  const kpis: LocalidadesKpis = { total, enUso, sinUso };

  return <LocalidadesClient rows={data} canManage={canManage} kpis={kpis} />;
}
