import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import { UnidadesMedidaClient, type UnidadMedidaRow } from "./unidades-medida-client";

export default async function UnidadesMedidaPage() {
  const session = await auth();
  const admin = isAdmin(session);

  const rows = await prisma.unidadMedida.findMany({
    select: { id: true, nombre: true, abreviacion: true, createdAt: true },
    orderBy: { nombre: "asc" },
  });

  const data: UnidadMedidaRow[] = rows.map((r) => ({ ...r }));

  return <UnidadesMedidaClient rows={data} isAdmin={admin} />;
}
