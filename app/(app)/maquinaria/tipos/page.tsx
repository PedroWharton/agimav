import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

import { TiposClient, type TipoRow, type TiposKpis } from "./tipos-client";

export default async function MaquinariaTiposPage() {
  const session = await auth();
  if (!hasPermission(session, "maquinaria.tipos.manage")) {
    redirect("/maquinaria");
  }

  const tipos = await prisma.maquinariaTipo.findMany({
    select: {
      id: true,
      nombre: true,
      estado: true,
      unidadMedicion: true,
      abrevUnidad: true,
      createdAt: true,
      _count: {
        select: { maquinarias: true, niveles: true },
      },
      niveles: {
        select: {
          _count: { select: { atributos: true } },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const rows: TipoRow[] = tipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    estado: t.estado,
    unidadMedicion: t.unidadMedicion,
    abrevUnidad: t.abrevUnidad,
    createdAt: t.createdAt,
    instanciasCount: t._count.maquinarias,
    nivelesCount: t._count.niveles,
    atributosCount: t.niveles.reduce((s, n) => s + n._count.atributos, 0),
  }));

  const activos = rows.filter((r) => r.estado !== "inactivo").length;
  const inactivos = rows.length - activos;
  const instanciasTotales = rows.reduce((s, r) => s + r.instanciasCount, 0);
  const atributosTotales = rows.reduce((s, r) => s + r.atributosCount, 0);

  const kpis: TiposKpis = {
    total: rows.length,
    activos,
    inactivos,
    instanciasTotales,
    atributosTotales,
  };

  return <TiposClient rows={rows} kpis={kpis} />;
}
