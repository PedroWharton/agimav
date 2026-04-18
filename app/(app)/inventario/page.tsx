import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin, isPañolero } from "@/lib/rbac";

import { InventarioClient, type InventarioRow } from "./inventario-client";

export default async function InventarioPage() {
  const session = await auth();
  const admin = isAdmin(session);
  const panolero = isPañolero(session);

  const [items, localidadesListado, unidadesProductivas, unidadesMedida] =
    await Promise.all([
      prisma.inventario.findMany({
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          categoria: true,
          localidad: true,
          unidadProductiva: true,
          unidadMedida: true,
          stock: true,
          stockMinimo: true,
          valorUnitario: true,
        },
        orderBy: { descripcion: "asc" },
      }),
      prisma.localidad.findMany({
        select: { nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.unidadProductiva.findMany({
        select: { nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.unidadMedida.findMany({
        select: { nombre: true, abreviacion: true },
        orderBy: { nombre: "asc" },
      }),
    ]);

  const rows: InventarioRow[] = items.map((i) => ({
    id: i.id,
    codigo: i.codigo ?? "",
    descripcion: i.descripcion ?? "",
    categoria: i.categoria ?? null,
    localidad: i.localidad ?? null,
    unidadProductiva: i.unidadProductiva ?? null,
    unidadMedida: i.unidadMedida ?? null,
    stock: i.stock,
    stockMinimo: i.stockMinimo,
    valorUnitario: i.valorUnitario,
  }));

  const categoriaSet = new Set<string>();
  const localidadSet = new Set<string>();
  for (const r of rows) {
    if (r.categoria) categoriaSet.add(r.categoria);
    if (r.localidad) localidadSet.add(r.localidad);
  }
  for (const l of localidadesListado) localidadSet.add(l.nombre);
  const categoriasDistinct = Array.from(categoriaSet).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const localidadesDistinct = Array.from(localidadSet).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const unidadesProductivasNombres = unidadesProductivas.map((u) => u.nombre);
  const unidadesMedidaNombres = unidadesMedida.map((u) => u.nombre);

  return (
    <InventarioClient
      rows={rows}
      categorias={categoriasDistinct}
      localidades={localidadesDistinct}
      unidadesProductivas={unidadesProductivasNombres}
      unidadesMedida={unidadesMedidaNombres}
      isAdmin={admin}
      canRegisterMovimiento={panolero}
    />
  );
}
