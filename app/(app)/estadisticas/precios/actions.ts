"use server";

import { prisma } from "@/lib/db";
import { rangeToGte } from "@/lib/stats/range";

import type { PreciosRange, PricePoint, PriceSeries } from "./types";

export async function getPriceSeries(
  itemId: number,
  range: PreciosRange,
): Promise<PriceSeries | null> {
  const item = await prisma.inventario.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      unidadMedida: true,
    },
  });
  if (!item) return null;

  const gte = rangeToGte(range);
  const where: {
    itemId: number;
    precioArs: { gt: number };
    fecha?: { gte: Date };
  } = {
    itemId,
    precioArs: { gt: 0 },
  };
  if (gte) where.fecha = { gte };

  const [rows, cotizaciones] = await Promise.all([
    prisma.precioHistorico.findMany({
      where,
      orderBy: { fecha: "asc" },
      include: { proveedor: { select: { nombre: true } } },
    }),
    prisma.dolarCotizacion.findMany({
      orderBy: [{ anio: "asc" }, { mes: "asc" }],
    }),
  ]);

  const cotMap = new Map<string, number>();
  for (const c of cotizaciones) {
    cotMap.set(`${c.anio}-${String(c.mes).padStart(2, "0")}`, c.tcPromedio);
  }
  const dolarFrom =
    cotizaciones.length > 0
      ? `${cotizaciones[0]!.anio}-${String(cotizaciones[0]!.mes).padStart(2, "0")}`
      : null;

  const points: PricePoint[] = rows.map((r) => {
    const iso = r.fecha.toISOString().slice(0, 10);
    const ym = iso.slice(0, 7);
    const tc = cotMap.get(ym);
    return {
      fecha: iso,
      precioArs: r.precioArs,
      precioUsd: tc && tc > 0 ? r.precioArs / tc : null,
      proveedor: r.proveedor?.nombre ?? null,
    };
  });

  return {
    itemId: item.id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidadMedida: item.unidadMedida,
    points,
    dolarFrom,
  };
}
