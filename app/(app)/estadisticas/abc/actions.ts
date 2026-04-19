"use server";

import * as XLSX from "xlsx";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const ABC_RANGES = ["30d", "90d", "ytd", "todo"] as const;
export type AbcRange = (typeof ABC_RANGES)[number];

export function rangeToGte(range: AbcRange): Date | null {
  const now = new Date();
  switch (range) {
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "todo":
      return null;
  }
}

export type AbcRow = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  cantidadConsumida: number;
  valorUnitario: number;
  valorConsumido: number;
  porcentaje: number;
  acumulado: number;
  clase: "A" | "B" | "C";
};

export type AbcResult = {
  rows: AbcRow[];
  valorTotal: number;
  sinConsumo: number;
  inventarioTotales: number;
  porClase: { a: number; b: number; c: number };
};

export async function computeAbc(range: AbcRange): Promise<AbcResult> {
  const gte = rangeToGte(range);

  const rows = await prisma.$queryRawUnsafe<
    {
      id: number;
      codigo: string | null;
      descripcion: string | null;
      unidad_medida: string | null;
      cantidad_consumida: number;
      valor_unitario: number;
      valor_consumido: number;
    }[]
  >(
    `SELECT
       i.id,
       i.codigo,
       i.descripcion,
       i.unidad_medida,
       COALESCE(SUM(im.cantidad), 0)::float as cantidad_consumida,
       COALESCE(i.valor_unitario, 0)::float as valor_unitario,
       (COALESCE(SUM(im.cantidad), 0) * COALESCE(i.valor_unitario, 0))::float as valor_consumido
     FROM inventario i
     INNER JOIN inventario_movimientos im ON im.id_item = i.id
     WHERE im.tipo = 'salida'
       ${gte ? "AND im.fecha >= $1" : ""}
     GROUP BY i.id, i.codigo, i.descripcion, i.unidad_medida, i.valor_unitario
     HAVING SUM(im.cantidad) > 0 AND COALESCE(i.valor_unitario, 0) > 0
     ORDER BY valor_consumido DESC`,
    ...(gte ? [gte] : []),
  );

  const valorTotal = rows.reduce((acc, r) => acc + r.valor_consumido, 0);

  let acumulado = 0;
  const classified: AbcRow[] = rows.map((r) => {
    const porcentaje = valorTotal > 0 ? (r.valor_consumido / valorTotal) * 100 : 0;
    acumulado += porcentaje;
    const clase: "A" | "B" | "C" =
      acumulado <= 80 ? "A" : acumulado <= 95 ? "B" : "C";
    return {
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      unidadMedida: r.unidad_medida,
      cantidadConsumida: r.cantidad_consumida,
      valorUnitario: r.valor_unitario,
      valorConsumido: r.valor_consumido,
      porcentaje,
      acumulado,
      clase,
    };
  });

  const porClase = classified.reduce(
    (acc, r) => {
      if (r.clase === "A") acc.a += r.valorConsumido;
      else if (r.clase === "B") acc.b += r.valorConsumido;
      else acc.c += r.valorConsumido;
      return acc;
    },
    { a: 0, b: 0, c: 0 },
  );

  const itemsConConsumo = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(DISTINCT im.id_item)::bigint as count
     FROM inventario_movimientos im
     WHERE im.tipo = 'salida'
       ${gte ? "AND im.fecha >= $1" : ""}`,
    ...(gte ? [gte] : []),
  );
  const inventarioTotales = await prisma.inventario.count();
  const conConsumo = Number(itemsConConsumo[0]?.count ?? 0);
  const sinConsumo = inventarioTotales - conConsumo;

  return {
    rows: classified,
    valorTotal,
    sinConsumo,
    inventarioTotales,
    porClase,
  };
}

export type ExportResult = { base64: string; filename: string };

export async function exportarAbc(range: AbcRange): Promise<ExportResult> {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");

  const result = await computeAbc(range);

  const headers = [
    "Código",
    "Descripción",
    "Unidad",
    "Cantidad consumida",
    "Valor unitario",
    "Valor consumido",
    "% del total",
    "% acumulado",
    "Clase",
  ];
  const data: (string | number | null)[][] = [
    headers,
    ...result.rows.map((r) => [
      r.codigo ?? "",
      r.descripcion ?? "",
      r.unidadMedida ?? "",
      r.cantidadConsumida,
      r.valorUnitario,
      r.valorConsumido,
      Number(r.porcentaje.toFixed(2)),
      Number(r.acumulado.toFixed(2)),
      r.clase,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ABC");
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return { base64, filename: `abc-inventario-${range}-${stamp}.xlsx` };
}
