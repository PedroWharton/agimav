import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import {
  UnidadesProductivasClient,
  type UnidadProductivaRow,
  type LocalidadOption,
  type TipoUnidadOption,
} from "./unidades-productivas-client";

export default async function UnidadesProductivasPage() {
  const session = await auth();
  const admin = isAdmin(session);

  const [unidades, localidades, tipos] = await Promise.all([
    prisma.unidadProductiva.findMany({
      select: {
        id: true,
        nombre: true,
        localidadId: true,
        localidad: { select: { nombre: true } },
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
    prisma.localidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tipoUnidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rows: UnidadProductivaRow[] = unidades.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    localidadId: u.localidadId ?? null,
    localidadNombre: u.localidad?.nombre ?? null,
    tipoUnidadId: u.tipoUnidadId ?? null,
    tipoUnidadNombre: u.tipoUnidad?.nombre ?? null,
    createdAt: u.createdAt,
    usageCount:
      u._count.ordenesTrabajo +
      u._count.mantenimientosUnidad +
      u._count.mantenimientosTaller,
  }));

  const localidadOptions: LocalidadOption[] = localidades.map((l) => ({
    id: l.id,
    nombre: l.nombre,
  }));
  const tipoOptions: TipoUnidadOption[] = tipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
  }));

  return (
    <UnidadesProductivasClient
      rows={rows}
      localidades={localidadOptions}
      tipos={tipoOptions}
      isAdmin={admin}
    />
  );
}
