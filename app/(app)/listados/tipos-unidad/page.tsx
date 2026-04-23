import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import {
  TiposUnidadClient,
  type TipoUnidadRow,
  type TiposUnidadKpis,
} from "./tipos-unidad-client";

export default async function TiposUnidadPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.master_data.manage");

  const rows = await prisma.tipoUnidad.findMany({
    select: {
      id: true,
      nombre: true,
      createdAt: true,
      _count: { select: { unidadesProductivas: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const data: TipoUnidadRow[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    unidadesCount: r._count.unidadesProductivas,
    createdAt: r.createdAt,
  }));

  const total = data.length;
  const enUso = data.filter((r) => r.unidadesCount > 0).length;

  const kpis: TiposUnidadKpis = { total, enUso };

  return <TiposUnidadClient rows={data} canManage={canManage} kpis={kpis} />;
}
