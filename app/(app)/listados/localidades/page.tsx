import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import { LocalidadesClient, type LocalidadRow } from "./localidades-client";

export default async function LocalidadesPage() {
  const session = await auth();
  const admin = isAdmin(session);

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

  return <LocalidadesClient rows={data} isAdmin={admin} />;
}
