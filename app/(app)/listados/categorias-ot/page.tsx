import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import {
  CategoriasOtClient,
  type CategoriaOtRow,
  type CategoriasOtKpis,
} from "./categorias-ot-client";

export default async function CategoriasOtPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.master_data.manage");

  const rows = await prisma.categoriaOt.findMany({
    select: {
      id: true,
      nombre: true,
      createdAt: true,
      _count: { select: { ordenesTrabajo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const data: CategoriaOtRow[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    otCount: r._count.ordenesTrabajo,
    createdAt: r.createdAt,
  }));

  const kpis: CategoriasOtKpis = {
    total: data.length,
    enUso: data.filter((r) => r.otCount > 0).length,
  };

  return <CategoriasOtClient rows={data} canManage={canManage} kpis={kpis} />;
}
