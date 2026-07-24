import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { accessibleUpIds } from "@/lib/up-scope";

import {
  MovimientosClient,
  type MovimientoRow,
  type MovimientosKpis,
} from "./movimientos-client";

export const dynamic = "force-dynamic";

export default async function MovimientosDiariosPage() {
  const session = await auth();
  requireViewOrRedirect(session, "inventario.view");
  const canManage = hasPermission(session, "inventario.movimiento.create");

  // WS-B3: scoping per-UP. `ups === null` ⇒ sin restricción (admin o sin
  // asignaciones). Si hay asignaciones, se ven los movimientos de esas UPs
  // más los sin UP.
  const ups = await accessibleUpIds(session);

  const registros = await prisma.movimientoDiario.findMany({
    where: ups
      ? {
          OR: [
            { unidadProductivaId: { in: ups } },
            { unidadProductivaId: null },
          ],
        }
      : {},
    select: {
      id: true,
      fecha: true,
      usuario: true,
      sector: true,
      localidad: true,
      lineas: { select: { tipo: true, devuelto: true, monto: true } },
    },
    orderBy: { fecha: "desc" },
    take: 300,
  });

  const rows: MovimientoRow[] = registros.map((r) => {
    const herramientasPendientes = r.lineas.filter(
      (l) => l.tipo === "herramienta" && !l.devuelto,
    ).length;
    return {
      id: r.id,
      fecha: r.fecha.toISOString(),
      usuario: r.usuario,
      sector: r.sector,
      localidad: r.localidad,
      lineas: r.lineas.length,
      herramientasPendientes,
      total: r.lineas.reduce((acc, l) => acc + (l.monto ?? 0), 0),
    };
  });

  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);
  const nuevos30d = registros.filter((r) => r.fecha >= since30d).length;
  const herramientasPendientesTotal = rows.reduce(
    (acc, r) => acc + r.herramientasPendientes,
    0,
  );

  const kpis: MovimientosKpis = {
    total: rows.length,
    nuevos30d,
    herramientasPendientes: herramientasPendientesTotal,
  };

  return (
    <MovimientosClient rows={rows} canManage={canManage} kpis={kpis} />
  );
}
