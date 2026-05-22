import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";

import { PreciosPendientesClient } from "./precios-pendientes-client";

export const dynamic = "force-dynamic";

export default async function PreciosPendientesPage() {
  const session = await auth();
  requireViewOrRedirect(session, "compras.view");
  const canResolve = hasPermission(session, "compras.factura.create");
  const t = await getTranslations("compras.preciosPendientes");

  const insumos = await prisma.mantenimientoInsumo.findMany({
    where: { precioPendiente: true },
    orderBy: { id: "asc" },
    select: {
      id: true,
      cantidadUtilizada: true,
      cantidadSugerida: true,
      unidadMedida: true,
      mantenimiento: {
        select: {
          id: true,
          maquinaria: {
            select: {
              nroSerie: true,
              tipo: { select: { nombre: true } },
            },
          },
        },
      },
      item: { select: { codigo: true, descripcion: true } },
    },
  });

  const rows = insumos.map((i) => ({
    id: i.id,
    itemCodigo: i.item.codigo ?? "",
    itemDescripcion: i.item.descripcion ?? "",
    cantidad: i.cantidadUtilizada || i.cantidadSugerida,
    unidadMedida: i.unidadMedida,
    mantenimientoId: i.mantenimiento.id,
    maquina: i.mantenimiento.maquinaria.nroSerie
      ? `${i.mantenimiento.maquinaria.tipo.nombre} · ${i.mantenimiento.maquinaria.nroSerie}`
      : i.mantenimiento.maquinaria.tipo.nombre,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t("titulo")} description={t("descripcion")} />
      <PreciosPendientesClient rows={rows} canResolve={canResolve} />
    </div>
  );
}
