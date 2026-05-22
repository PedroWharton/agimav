import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { getLocalidadesSugeridas } from "@/lib/localidades";

import {
  UnidadesProductivasClient,
  type UnidadProductivaRow,
  type TipoUnidadOption,
  type UnidadesProductivasKpis,
} from "./unidades-productivas-client";

export default async function UnidadesProductivasPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");
  const canManage = hasPermission(session, "listados.master_data.manage");

  const [unidades, localidades, tipos] = await Promise.all([
    prisma.unidadProductiva.findMany({
      select: {
        id: true,
        nombre: true,
        localidad: true,
        tipoUnidadId: true,
        tipoUnidad: { select: { nombre: true } },
        createdAt: true,
        _count: {
          select: {
            ordenesTrabajo: true,
            mantenimientosUnidad: true,
            mantenimientosTaller: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    getLocalidadesSugeridas(),
    prisma.tipoUnidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rows: UnidadProductivaRow[] = unidades.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    localidad: u.localidad ?? null,
    tipoUnidadId: u.tipoUnidadId ?? null,
    tipoUnidadNombre: u.tipoUnidad?.nombre ?? null,
    createdAt: u.createdAt,
    usageCount:
      u._count.ordenesTrabajo +
      u._count.mantenimientosUnidad +
      u._count.mantenimientosTaller,
  }));

  const tipoOptions: TipoUnidadOption[] = tipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
  }));

  const total = rows.length;
  const enUso = rows.filter((r) => r.usageCount > 0).length;
  const sinLocalidad = rows.filter((r) => !r.localidad).length;

  const kpis: UnidadesProductivasKpis = { total, enUso, sinLocalidad };

  return (
    <UnidadesProductivasClient
      rows={rows}
      localidades={localidades}
      tipos={tipoOptions}
      canManage={canManage}
      kpis={kpis}
    />
  );
}
