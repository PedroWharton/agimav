"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as XLSX from "xlsx";
import { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin, requirePañolero, userIdFromSession } from "@/lib/rbac";
import { round4 } from "@/lib/format";
import { ITEM_HEADERS } from "@/lib/xlsx-headers";

import type {
  ExportResult,
  ImportPreview,
  ImportPreviewRow,
  ImportRow,
  InventarioActionResult,
  MovimientoExportFilter,
  RecentMovimiento,
} from "./types";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null)));

const itemSchema = z.object({
  codigo: z.string().trim().min(1, "Obligatorio").max(50),
  descripcion: z.string().trim().min(1, "Obligatorio").max(300),
  categoria: optionalTrimmed(100),
  localidad: optionalTrimmed(100),
  unidadProductiva: optionalTrimmed(100),
  unidadMedida: optionalTrimmed(50),
  stockMinimo: z.coerce.number().nonnegative().default(0),
  valorUnitario: z.coerce.number().nonnegative().default(0),
});

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createItem(raw: unknown): Promise<InventarioActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const data = parsed.data;
  const valorUnitario = round4(data.valorUnitario);

  try {
    const created = await prisma.inventario.create({
      data: {
        codigo: data.codigo,
        descripcion: data.descripcion,
        categoria: data.categoria,
        localidad: data.localidad,
        unidadProductiva: data.unidadProductiva,
        unidadMedida: data.unidadMedida,
        stock: 0,
        stockMinimo: data.stockMinimo,
        valorUnitario,
        valorTotal: 0,
        createdById: userIdFromSession(session),
      },
      select: { id: true },
    });
    revalidatePath("/inventario");
    return { ok: true, id: created.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicate_codigo" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function updateItem(
  id: number,
  raw: unknown,
): Promise<InventarioActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const data = parsed.data;
  const valorUnitario = round4(data.valorUnitario);

  try {
    const updated = await prisma.inventario.update({
      where: { id },
      data: {
        codigo: data.codigo,
        descripcion: data.descripcion,
        categoria: data.categoria,
        localidad: data.localidad,
        unidadProductiva: data.unidadProductiva,
        unidadMedida: data.unidadMedida,
        stockMinimo: data.stockMinimo,
        valorUnitario,
      },
      select: { id: true, stock: true },
    });
    await prisma.inventario.update({
      where: { id },
      data: { valorTotal: round4(updated.stock * valorUnitario) },
    });
    revalidatePath("/inventario");
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicate_codigo" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function getRecentMovimientos(
  itemId: number,
  take = 10,
): Promise<RecentMovimiento[]> {
  const session = await auth();
  if (!session?.user) return [];
  const rows = await prisma.inventarioMovimiento.findMany({
    where: { idItem: itemId },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      fecha: true,
      tipo: true,
      cantidad: true,
      valorUnitario: true,
      unidadMedida: true,
      moduloOrigen: true,
      idOrigen: true,
      motivo: true,
      usuario: true,
    },
  });
  return rows;
}

const movimientoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("entrada"),
    cantidad: z.number().positive("Cantidad debe ser mayor a 0"),
    valorUnitario: z.number().nonnegative(),
    motivo: z.string().trim().min(1, "Obligatorio").max(200),
    observaciones: optionalTrimmed(500),
  }),
  z.object({
    tipo: z.literal("salida"),
    cantidad: z.number().positive("Cantidad debe ser mayor a 0"),
    motivo: z.string().trim().min(1, "Obligatorio").max(200),
    observaciones: optionalTrimmed(500),
  }),
  z.object({
    tipo: z.literal("ajuste_precio"),
    valorUnitario: z.number().nonnegative(),
    motivo: z.string().trim().min(1, "Obligatorio").max(200),
    observaciones: optionalTrimmed(500),
  }),
]);

export async function registerMovimiento(
  itemId: number,
  raw: unknown,
): Promise<InventarioActionResult> {
  const session = await auth();
  try {
    requirePañolero(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = movimientoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const data = parsed.data;
  const usuarioNombre = session?.user?.name ?? session?.user?.email ?? "sistema";
  const createdById = userIdFromSession(session);

  try {
    const movId = await prisma.$transaction(async (tx) => {
      const item = await tx.inventario.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          stock: true,
          valorUnitario: true,
          unidadMedida: true,
        },
      });
      if (!item) throw new Error("not_found");

      let nuevoStock = item.stock;
      let nuevoValorUnitario = item.valorUnitario;
      let tipoDb: "entrada" | "salida";
      let cantidadDb: number;
      let valorMovDb: number;
      let moduloOrigen: string;

      if (data.tipo === "entrada") {
        const qty = data.cantidad;
        const newVal = round4(data.valorUnitario);
        nuevoStock = item.stock + qty;
        if (item.stock + qty > 0) {
          nuevoValorUnitario = round4(
            (Math.max(item.stock, 0) * item.valorUnitario + qty * newVal) /
              (Math.max(item.stock, 0) + qty),
          );
        } else {
          nuevoValorUnitario = newVal;
        }
        tipoDb = "entrada";
        cantidadDb = qty;
        valorMovDb = newVal;
        moduloOrigen = "mov_diario";
      } else if (data.tipo === "salida") {
        const qty = data.cantidad;
        nuevoStock = item.stock - qty;
        tipoDb = "salida";
        cantidadDb = qty;
        valorMovDb = round4(item.valorUnitario);
        moduloOrigen = "mov_diario";
      } else {
        nuevoValorUnitario = round4(data.valorUnitario);
        tipoDb = "entrada";
        cantidadDb = 0;
        valorMovDb = nuevoValorUnitario;
        moduloOrigen = "ajustes";
      }

      const nuevoValorTotal = round4(nuevoStock * nuevoValorUnitario);

      await tx.inventario.update({
        where: { id: itemId },
        data: {
          stock: nuevoStock,
          valorUnitario: nuevoValorUnitario,
          valorTotal: nuevoValorTotal,
        },
      });

      const mov = await tx.inventarioMovimiento.create({
        data: {
          idItem: itemId,
          tipo: tipoDb,
          cantidad: cantidadDb,
          unidadMedida: item.unidadMedida,
          valorUnitario: valorMovDb,
          fecha: new Date(),
          usuario: usuarioNombre,
          motivo: data.motivo,
          moduloOrigen,
          observaciones: data.observaciones,
          createdById,
        },
        select: { id: true },
      });

      return mov.id;
    });

    revalidatePath("/inventario");
    revalidatePath("/inventario/movimientos");
    revalidatePath(`/inventario/${itemId}/movimientos`);
    return { ok: true, id: movId };
  } catch (e) {
    if (e instanceof Error && e.message === "not_found") {
      return { ok: false, error: "not_found" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function deleteItem(id: number): Promise<InventarioActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const [movs, requisitionLines, otInsumos, plantillaInsumos, mantInsumos, maquinaNodos, precios] =
    await Promise.all([
      prisma.inventarioMovimiento.count({ where: { idItem: id } }),
      prisma.requisicionDetalle.count({ where: { itemId: id } }),
      prisma.otInsumo.count({ where: { itemInventarioId: id } }),
      prisma.plantillaInsumo.count({ where: { itemInventarioId: id } }),
      prisma.mantenimientoInsumo.count({ where: { itemInventarioId: id } }),
      prisma.maquinaNodo.count({ where: { inventarioItemId: id } }),
      prisma.precioHistorico.count({ where: { itemId: id } }),
    ]);

  if (movs > 0) {
    return { ok: false, error: "in_use_movs", count: movs };
  }
  const refs =
    requisitionLines + otInsumos + plantillaInsumos + mantInsumos + maquinaNodos + precios;
  if (refs > 0) {
    return { ok: false, error: "in_use_refs", count: refs };
  }

  try {
    await prisma.inventario.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/inventario");
  return { ok: true };
}

function sheetToBase64(rows: (string | number | null)[][]): string {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  return buf as string;
}

function sheetToBase64Named(
  rows: (string | number | null)[][],
  sheetName: string,
): string {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
}

export async function exportarInventario(): Promise<ExportResult> {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");

  const items = await prisma.inventario.findMany({
    orderBy: [{ descripcion: "asc" }, { id: "asc" }],
    select: {
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
  });

  const rows: (string | number | null)[][] = [
    [...ITEM_HEADERS],
    ...items.map((i) => [
      i.codigo ?? "",
      i.descripcion ?? "",
      i.categoria ?? "",
      i.localidad ?? "",
      i.unidadProductiva ?? "",
      i.unidadMedida ?? "",
      round4(i.stock),
      round4(i.stockMinimo),
      round4(i.valorUnitario),
      round4(i.stock * i.valorUnitario),
    ]),
  ];

  const base64 = sheetToBase64(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return { base64, filename: `inventario_${stamp}.xlsx` };
}

export async function exportarMovimientos(
  filter: MovimientoExportFilter,
): Promise<ExportResult> {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");

  const desde = filter.desde ? new Date(filter.desde) : undefined;
  const hasta = filter.hasta ? new Date(filter.hasta) : undefined;
  const where = {
    ...(filter.itemId && filter.itemId > 0 ? { idItem: filter.itemId } : {}),
    ...(filter.tipo && filter.tipo !== "todos" ? { tipo: filter.tipo } : {}),
    ...(filter.modulo && filter.modulo !== "todos"
      ? filter.modulo === "sin_modulo"
        ? { moduloOrigen: null }
        : { moduloOrigen: filter.modulo }
      : {}),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde && !Number.isNaN(desde.getTime()) ? { gte: desde } : {}),
            ...(hasta && !Number.isNaN(hasta.getTime()) ? { lte: hasta } : {}),
          },
        }
      : {}),
  };

  const movs = await prisma.inventarioMovimiento.findMany({
    where,
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: 10_000,
    select: {
      fecha: true,
      tipo: true,
      cantidad: true,
      unidadMedida: true,
      valorUnitario: true,
      moduloOrigen: true,
      idOrigen: true,
      motivo: true,
      observaciones: true,
      usuario: true,
      item: { select: { codigo: true, descripcion: true } },
    },
  });

  const rows: (string | number | null)[][] = [
    [
      "Fecha",
      "Código",
      "Descripción",
      "Tipo",
      "Cantidad",
      "Unidad",
      "Valor unitario",
      "Módulo",
      "ID origen",
      "Motivo",
      "Observaciones",
      "Usuario",
    ],
    ...movs.map((m) => [
      m.fecha.toISOString().slice(0, 10),
      m.item?.codigo ?? "",
      m.item?.descripcion ?? "",
      m.tipo,
      round4(m.cantidad),
      m.unidadMedida ?? "",
      round4(m.valorUnitario),
      m.moduloOrigen ?? "",
      m.idOrigen ?? "",
      m.motivo ?? "",
      m.observaciones ?? "",
      m.usuario,
    ]),
  ];

  const base64 = sheetToBase64Named(rows, "Movimientos");
  const stamp = new Date().toISOString().slice(0, 10);
  const scope = filter.itemId ? `_item${filter.itemId}` : "";
  return { base64, filename: `movimientos${scope}_${stamp}.xlsx` };
}

const MAX_IMPORT_ROWS = 5000;

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumberOrError(
  v: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  if (v === null || v === undefined || v === "") return { ok: true, value: 0 };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { ok: false, error: "no_finito" };
    return { ok: true, value: v };
  }
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, error: "no_numerico" };
  return { ok: true, value: n };
}

type NormalizedRow = {
  rowIndex: number;
  codigo: string;
  descripcion: string;
  categoria: string | null;
  localidad: string | null;
  unidadProductiva: string | null;
  unidadMedida: string | null;
  stockMinimo: number;
  valorUnitario: number;
};

function classifyRows(raw: ImportRow[]): {
  valid: NormalizedRow[];
  preview: ImportPreviewRow[];
} {
  const seenCodigos = new Map<string, number>();
  const valid: NormalizedRow[] = [];
  const preview: ImportPreviewRow[] = [];

  raw.forEach((row, idx) => {
    const rowIndex = idx + 2;
    const codigo = trimOrNull(row.codigo);
    const descripcion = trimOrNull(row.descripcion);

    if (!codigo) {
      preview.push({
        rowIndex,
        codigo: null,
        descripcion,
        status: "invalid",
        invalidReason: "falta_codigo",
      });
      return;
    }
    if (!descripcion) {
      preview.push({
        rowIndex,
        codigo,
        descripcion: null,
        status: "invalid",
        invalidReason: "falta_descripcion",
      });
      return;
    }
    if (codigo.length > 50) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "codigo_demasiado_largo",
      });
      return;
    }
    if (descripcion.length > 300) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "descripcion_demasiado_larga",
      });
      return;
    }
    if (seenCodigos.has(codigo)) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "codigo_duplicado_en_archivo",
      });
      return;
    }

    const stockMin = parseNumberOrError(row.stockMinimo);
    if (!stockMin.ok) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "stock_minimo_invalido",
      });
      return;
    }
    if (stockMin.value < 0) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "stock_minimo_negativo",
      });
      return;
    }

    const valorU = parseNumberOrError(row.valorUnitario);
    if (!valorU.ok) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "valor_unitario_invalido",
      });
      return;
    }
    if (valorU.value < 0) {
      preview.push({
        rowIndex,
        codigo,
        descripcion,
        status: "invalid",
        invalidReason: "valor_unitario_negativo",
      });
      return;
    }

    seenCodigos.set(codigo, rowIndex);
    valid.push({
      rowIndex,
      codigo,
      descripcion,
      categoria: trimOrNull(row.categoria),
      localidad: trimOrNull(row.localidad),
      unidadProductiva: trimOrNull(row.unidadProductiva),
      unidadMedida: trimOrNull(row.unidadMedida),
      stockMinimo: stockMin.value,
      valorUnitario: round4(valorU.value),
    });
  });

  return { valid, preview };
}

export async function previewImportInventario(
  raw: ImportRow[],
): Promise<ImportPreview | { error: string }> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { error: "forbidden" };
  }
  if (!Array.isArray(raw)) return { error: "invalid_payload" };
  if (raw.length === 0) return { error: "archivo_vacio" };
  if (raw.length > MAX_IMPORT_ROWS) return { error: "demasiadas_filas" };

  const { valid, preview } = classifyRows(raw);

  const codigos = valid.map((v) => v.codigo);
  const existing = await prisma.inventario.findMany({
    where: { codigo: { in: codigos } },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      categoria: true,
      localidad: true,
      unidadProductiva: true,
      unidadMedida: true,
      stockMinimo: true,
      valorUnitario: true,
    },
  });
  const byCodigo = new Map(existing.map((e) => [e.codigo!, e]));

  for (const row of valid) {
    const current = byCodigo.get(row.codigo);
    if (!current) {
      preview.push({
        rowIndex: row.rowIndex,
        codigo: row.codigo,
        descripcion: row.descripcion,
        status: "new",
      });
      continue;
    }
    const changed: string[] = [];
    if ((current.descripcion ?? "") !== row.descripcion) changed.push("descripcion");
    if ((current.categoria ?? null) !== row.categoria) changed.push("categoria");
    if ((current.localidad ?? null) !== row.localidad) changed.push("localidad");
    if ((current.unidadProductiva ?? null) !== row.unidadProductiva)
      changed.push("unidadProductiva");
    if ((current.unidadMedida ?? null) !== row.unidadMedida)
      changed.push("unidadMedida");
    if (round4(current.stockMinimo) !== row.stockMinimo) changed.push("stockMinimo");
    if (round4(current.valorUnitario) !== row.valorUnitario) changed.push("valorUnitario");

    preview.push({
      rowIndex: row.rowIndex,
      codigo: row.codigo,
      descripcion: row.descripcion,
      status: changed.length === 0 ? "unchanged" : "updated",
      changedFields: changed.length ? changed : undefined,
    });
  }

  preview.sort((a, b) => a.rowIndex - b.rowIndex);

  const counts = { new: 0, updated: 0, unchanged: 0, invalid: 0 };
  for (const r of preview) counts[r.status]++;

  return { counts, rows: preview, total: preview.length };
}

export async function commitImportInventario(
  raw: ImportRow[],
  opts: { ignorarInvalidos: boolean },
): Promise<
  | { ok: true; aplicados: number; ignorados: number }
  | { ok: false; error: string; count?: number }
> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "invalid_payload" };
  if (raw.length === 0) return { ok: false, error: "archivo_vacio" };
  if (raw.length > MAX_IMPORT_ROWS) return { ok: false, error: "demasiadas_filas" };

  const { valid, preview } = classifyRows(raw);
  const invalidCount = preview.filter((r) => r.status === "invalid").length;
  if (invalidCount > 0 && !opts.ignorarInvalidos) {
    return { ok: false, error: "tiene_invalidos", count: invalidCount };
  }

  const createdById = userIdFromSession(session);

  const codigos = valid.map((v) => v.codigo);
  const existing = await prisma.inventario.findMany({
    where: { codigo: { in: codigos } },
    select: {
      id: true,
      codigo: true,
      stock: true,
    },
  });
  const byCodigo = new Map(existing.map((e) => [e.codigo!, e]));

  let aplicados = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of valid) {
        const current = byCodigo.get(row.codigo);
        if (current) {
          await tx.inventario.update({
            where: { id: current.id },
            data: {
              descripcion: row.descripcion,
              categoria: row.categoria,
              localidad: row.localidad,
              unidadProductiva: row.unidadProductiva,
              unidadMedida: row.unidadMedida,
              stockMinimo: row.stockMinimo,
              valorUnitario: row.valorUnitario,
              valorTotal: round4(current.stock * row.valorUnitario),
            },
          });
          aplicados++;
        } else {
          await tx.inventario.create({
            data: {
              codigo: row.codigo,
              descripcion: row.descripcion,
              categoria: row.categoria,
              localidad: row.localidad,
              unidadProductiva: row.unidadProductiva,
              unidadMedida: row.unidadMedida,
              stock: 0,
              stockMinimo: row.stockMinimo,
              valorUnitario: row.valorUnitario,
              valorTotal: 0,
              createdById,
            },
          });
          aplicados++;
        }
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicate_codigo" };
    }
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/inventario");
  return { ok: true, aplicados, ignorados: invalidCount };
}
