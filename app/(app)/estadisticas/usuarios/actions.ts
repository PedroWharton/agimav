"use server";

import * as XLSX from "xlsx";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { rangeToGte } from "@/lib/stats/range";

import type { ExportResult, UsrRange, UsrResult, UsrRow } from "./types";

/** Normaliza un nombre para mergear facturas y requisiciones del mismo usuario. */
function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * WS-E · Gasto por usuario. Combina dos fuentes de texto libre:
 *  - Factura.usuario   → "qué gasta" (el gasto literal en dinero).
 *  - Requisicion.solicitante → "qué pide cada uno".
 * Las facturas legacy traen usuario='Sistema'; la métrica se llena con datos
 * nuevos post-cutover.
 */
export async function computeGastoPorUsuario(
  range: UsrRange,
): Promise<UsrResult> {
  const session = await auth();
  requirePermission(session, "estadisticas.proveedores.view");

  const gte = rangeToGte(range);

  const [facturas, requisiciones] = await Promise.all([
    prisma.factura.groupBy({
      by: ["usuario"],
      _sum: { total: true },
      _count: { _all: true },
      _max: { fechaFactura: true },
      where: gte ? { fechaFactura: { gte } } : undefined,
    }),
    prisma.requisicion.groupBy({
      by: ["solicitante"],
      _count: { _all: true },
      _max: { fechaCreacion: true },
      where: gte ? { fechaCreacion: { gte } } : undefined,
    }),
  ]);

  type Acc = {
    nombre: string;
    facturas: number;
    gasto: number;
    requisiciones: number;
    ultima: Date | null;
  };
  const byKey = new Map<string, Acc>();

  const touch = (rawNombre: string): Acc => {
    const key = normName(rawNombre);
    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        nombre: rawNombre.trim(),
        facturas: 0,
        gasto: 0,
        requisiciones: 0,
        ultima: null,
      };
      byKey.set(key, acc);
    }
    return acc;
  };

  const maxFecha = (a: Date | null, b: Date | null): Date | null => {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
  };

  for (const f of facturas) {
    const nombre = (f.usuario ?? "").trim();
    if (!nombre) continue;
    const acc = touch(nombre);
    acc.facturas += f._count._all;
    acc.gasto += f._sum.total ?? 0;
    acc.ultima = maxFecha(acc.ultima, f._max.fechaFactura);
  }

  for (const r of requisiciones) {
    const nombre = (r.solicitante ?? "").trim();
    if (!nombre) continue;
    const acc = touch(nombre);
    acc.requisiciones += r._count._all;
    acc.ultima = maxFecha(acc.ultima, r._max.fechaCreacion);
  }

  const totalGasto = [...byKey.values()].reduce((a, x) => a + x.gasto, 0);

  const rows: UsrRow[] = [...byKey.values()]
    .map((x) => ({
      nombre: x.nombre,
      facturas: x.facturas,
      gasto: x.gasto,
      porcentaje: totalGasto > 0 ? (x.gasto / totalGasto) * 100 : 0,
      requisiciones: x.requisiciones,
      ultima: x.ultima,
    }))
    .sort(
      (a, b) =>
        b.gasto - a.gasto ||
        b.requisiciones - a.requisiciones ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  return {
    rows,
    totalGasto,
    usuariosConGasto: rows.filter((r) => r.gasto > 0).length,
    requisicionesTotal: rows.reduce((a, r) => a + r.requisiciones, 0),
  };
}

export async function exportarUsuarios(
  range: UsrRange,
): Promise<ExportResult> {
  const session = await auth();
  requirePermission(session, "estadisticas.export");

  const result = await computeGastoPorUsuario(range);

  const headers = [
    "Usuario",
    "Facturas",
    "Gasto",
    "% del total",
    "Requisiciones",
    "Última actividad",
  ];
  const data: (string | number | null)[][] = [
    headers,
    ...result.rows.map((r) => [
      r.nombre,
      r.facturas,
      r.gasto,
      Number(r.porcentaje.toFixed(2)),
      r.requisiciones,
      r.ultima ? r.ultima.toISOString().slice(0, 10) : "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gasto por usuario");
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return {
    base64,
    filename: `gasto-usuarios-${range}-${stamp}.xlsx`,
  };
}
