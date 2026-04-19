"use server";

import * as XLSX from "xlsx";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import type {
  ExportResult,
  ProvRange,
  ProvResult,
  ProvRow,
} from "./types";

function rangeToGte(range: ProvRange): Date | null {
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

export async function computeProveedoresGasto(
  range: ProvRange,
): Promise<ProvResult> {
  const gte = rangeToGte(range);

  const grouped = await prisma.factura.groupBy({
    by: ["proveedorId"],
    _sum: { total: true },
    _count: { _all: true },
    _max: { fechaFactura: true },
    where: gte ? { fechaFactura: { gte } } : undefined,
    orderBy: { _sum: { total: "desc" } },
  });

  const totalGeneral = grouped.reduce(
    (acc, g) => acc + (g._sum.total ?? 0),
    0,
  );

  const proveedores =
    grouped.length > 0
      ? await prisma.proveedor.findMany({
          where: { id: { in: grouped.map((g) => g.proveedorId) } },
          select: { id: true, nombre: true },
        })
      : [];
  const byId = new Map(proveedores.map((p) => [p.id, p]));

  const rows: ProvRow[] = grouped.map((g) => {
    const prov = byId.get(g.proveedorId);
    const total = g._sum.total ?? 0;
    return {
      id: g.proveedorId,
      nombre: prov?.nombre ?? `#${g.proveedorId}`,
      facturas: g._count._all,
      total,
      porcentaje: totalGeneral > 0 ? (total / totalGeneral) * 100 : 0,
      ultima: g._max.fechaFactura,
    };
  });

  const proveedoresTotales = await prisma.proveedor.count();

  return {
    rows,
    totalGeneral,
    proveedoresConFacturas: rows.length,
    proveedoresTotales,
  };
}

export async function exportarProveedores(
  range: ProvRange,
): Promise<ExportResult> {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");

  const result = await computeProveedoresGasto(range);

  const headers = [
    "Proveedor",
    "Facturas",
    "Total",
    "% del total",
    "Última factura",
  ];
  const data: (string | number | null)[][] = [
    headers,
    ...result.rows.map((r) => [
      r.nombre,
      r.facturas,
      r.total,
      Number(r.porcentaje.toFixed(2)),
      r.ultima ? r.ultima.toISOString().slice(0, 10) : "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gasto por proveedor");
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return {
    base64,
    filename: `gasto-proveedores-${range}-${stamp}.xlsx`,
  };
}
