import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin, userNameFromSession } from "@/lib/rbac";

import {
  SolicitudesClient,
  type SolicitudRow,
  type SolicitudesKpis,
} from "./solicitudes-client";

export default async function SolicitudesPage() {
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

  const rows: SolicitudRow[] = reqs.map((r) => ({
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

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const kpis: SolicitudesKpis = {
    total: reqs.length,
    pendientes: reqs.filter((r) => r.estado === "En Revisión").length,
    aprobadasSinOc: reqs.filter(
      (r) => r.estado === "Aprobada" || r.estado === "Asignado a Proveedor",
    ).length,
    delMes: reqs.filter(
      (r) => r.fechaCreacion && r.fechaCreacion >= monthStart,
    ).length,
    monthStartIso: monthStart.toISOString(),
  };

  return (
    <SolicitudesClient
      rows={rows}
      unidadesProductivas={upOptions}
      isAdmin={admin}
      currentUserName={currentUser}
      kpis={kpis}
    />
  );
}
