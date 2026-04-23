import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import {
  UnidadesMedidaClient,
  type UnidadMedidaRow,
  type UnidadesMedidaKpis,
} from "./unidades-medida-client";

export default async function UnidadesMedidaPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.master_data.manage");

  const rows = await prisma.unidadMedida.findMany({
    select: { id: true, nombre: true, abreviacion: true, createdAt: true },
    orderBy: { nombre: "asc" },
  });

  const data: UnidadMedidaRow[] = rows.map((r) => ({ ...r }));

  const kpis: UnidadesMedidaKpis = { total: data.length };

  return <UnidadesMedidaClient rows={data} canManage={canManage} kpis={kpis} />;
}
