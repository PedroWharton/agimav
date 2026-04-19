"use server";

import { prisma } from "@/lib/db";

export const PRECIOS_RANGES = ["90d", "ytd", "todo"] as const;
export type PreciosRange = (typeof PRECIOS_RANGES)[number];

function rangeToGte(range: PreciosRange): Date | null {
  const now = new Date();
  switch (range) {
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "todo":
      return null;
  }
}

export type PricePoint = {
  fecha: string; // ISO YYYY-MM-DD
  precioArs: number;
  precioUsd: number | null;
  proveedor: string | null;
};

export type PriceSeries = {
  itemId: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  points: PricePoint[];
  dolarFrom: string | null; // earliest month with a cotización, "YYYY-MM"
};

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
