import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin, userNameFromSession } from "@/lib/rbac";

import {
  RequisicionesClient,
  type RequisicionRow,
} from "./requisiciones-client";

export default async function RequisicionesPage() {
  const session = await auth();
  const admin = isAdmin(session);
  const currentUser = userNameFromSession(session);

  const [reqs, unidadesProductivas] = await Promise.all([
    prisma.requisicion.findMany({
      select: {
        id: true,
        fechaCreacion: true,
        solicitante: true,
        unidadProductiva: true,
        localidad: true,
        prioridad: true,
        estado: true,
        creadoPor: true,
        _count: { select: { detalle: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.unidadProductiva.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rows: RequisicionRow[] = reqs.map((r) => ({
    id: r.id,
    fechaCreacion: r.fechaCreacion.toISOString(),
    solicitante: r.solicitante,
    unidadProductiva: r.unidadProductiva,
    localidad: r.localidad,
    prioridad: r.prioridad,
    estado: r.estado,
    creadoPor: r.creadoPor,
    lineasCount: r._count.detalle,
  }));

  const upSet = new Set<string>();
  for (const r of rows) if (r.unidadProductiva) upSet.add(r.unidadProductiva);
  for (const u of unidadesProductivas) upSet.add(u.nombre);
  const upOptions = Array.from(upSet).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return (
    <RequisicionesClient
      rows={rows}
      unidadesProductivas={upOptions}
      isAdmin={admin}
      currentUserName={currentUser}
    />
  );
}
