import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";

import { InventarioClient, type InventarioRow } from "./inventario-client";

export default async function InventarioPage() {
  const session = await auth();
  requireViewOrRedirect(session, "inventario.view");
  const canCreate = hasPermission(session, "inventario.create");
  const canUpdate = hasPermission(session, "inventario.update");
  const canDelete = hasPermission(session, "inventario.delete");
  const canImport = hasPermission(session, "inventario.import_export");
  const canRegisterMovimiento = hasPermission(
    session,
    "inventario.movimiento.create",
  );

  const [
    items,
    localidadesListado,
    unidadesProductivas,
    unidadesMedida,
    lastMovimiento,
  ] = await Promise.all([
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
    prisma.inventarioMovimiento.findFirst({
      select: { fecha: true },
      orderBy: { fecha: "desc" },
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

  let bajoMinimoTotal = 0;
  let stockNegativoTotal = 0;
  let valorTotalAcum = 0;
  for (const r of rows) {
    if (r.stock < 0) stockNegativoTotal++;
    else if (r.stockMinimo > 0 && r.stock < r.stockMinimo) bajoMinimoTotal++;
    valorTotalAcum += Math.max(r.stock, 0) * r.valorUnitario;
  }

  const kpis = {
    total: rows.length,
    bajoMinimo: bajoMinimoTotal,
    stockNegativo: stockNegativoTotal,
    valorTotal: valorTotalAcum,
  };

  return (
    <InventarioClient
      rows={rows}
      categorias={categoriasDistinct}
      localidades={localidadesDistinct}
      unidadesProductivas={unidadesProductivasNombres}
      unidadesMedida={unidadesMedidaNombres}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canImport={canImport}
      canRegisterMovimiento={canRegisterMovimiento}
      kpis={kpis}
      lastMovimientoAt={lastMovimiento?.fecha ?? null}
    />
  );
}
