"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  requireAuthenticated,
  userNameFromSession,
} from "@/lib/rbac";
import { formatOTNumber } from "@/lib/ot/ot-number";

export const OT_ESTADOS = ["En Curso", "Cerrada", "Cancelada"] as const;
export type OtEstado = (typeof OT_ESTADOS)[number];

export const OT_PRIORIDADES = ["Baja", "Media", "Alta"] as const;
export type OtPrioridad = (typeof OT_PRIORIDADES)[number];

export function otIsActiva(estado: string): boolean {
  return estado === "En Curso";
}

export function otIsTerminal(estado: string): boolean {
  return estado === "Cerrada" || estado === "Cancelada";
}

export type OtActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "wrong_estado"
        | "stock_insuficiente"
        | "unknown";
      fieldErrors?: Record<string, string>;
    };

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null)));

const optionalId = z.coerce
  .number()
  .int()
  .positive()
  .optional()
  .nullable()
  .transform((v) => v ?? null);

const createSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descripcionTrabajo: optionalText(2000),
  localidadId: optionalId,
  unidadProductivaId: optionalId,
  solicitanteId: optionalId,
  responsableId: optionalId,
  prioridad: z.enum(OT_PRIORIDADES).default("Media"),
  observaciones: optionalText(2000),
});

export async function createOT(
  raw: unknown,
): Promise<OtActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;
  const userName = userNameFromSession(session);

  try {
    const ot = await prisma.ordenTrabajo.create({
      data: {
        titulo: data.titulo,
        descripcionTrabajo: data.descripcionTrabajo,
        localidadId: data.localidadId,
        unidadProductivaId: data.unidadProductivaId,
        solicitanteId: data.solicitanteId,
        responsableId: data.responsableId,
        prioridad: data.prioridad,
        observaciones: data.observaciones,
        estado: "En Curso",
        creadoPor: userName,
      },
    });
    await prisma.ordenTrabajo.update({
      where: { id: ot.id },
      data: { numeroOt: formatOTNumber(ot.id) },
    });
    revalidatePath("/ordenes-trabajo");
    return { ok: true, id: ot.id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function updateOT(
  id: number,
  raw: unknown,
): Promise<OtActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.ordenTrabajo.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (otIsTerminal(existing.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  try {
    await prisma.ordenTrabajo.update({
      where: { id },
      data: {
        titulo: data.titulo,
        descripcionTrabajo: data.descripcionTrabajo,
        localidadId: data.localidadId,
        unidadProductivaId: data.unidadProductivaId,
        solicitanteId: data.solicitanteId,
        responsableId: data.responsableId,
        prioridad: data.prioridad,
        observaciones: data.observaciones,
      },
    });
    revalidatePath("/ordenes-trabajo");
    revalidatePath(`/ordenes-trabajo/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const insumoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  itemInventarioId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().min(0),
  unidadMedida: z.string().trim().max(50).default(""),
  costoUnitario: z.coerce.number().min(0).default(0),
});

const saveInsumosSchema = z.object({
  insumos: z.array(insumoSchema).default([]),
});

export async function saveOtInsumos(
  id: number,
  raw: unknown,
): Promise<OtActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!ot) return { ok: false, error: "not_found" };
  if (otIsTerminal(ot.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  const parsed = saveInsumosSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.otInsumo.findMany({
        where: { otId: id },
        select: { id: true },
      });
      const keep = new Set<number>(
        data.insumos
          .map((l) => l.id)
          .filter((v): v is number => typeof v === "number"),
      );
      const toDelete = existing
        .map((l) => l.id)
        .filter((x) => !keep.has(x));
      if (toDelete.length > 0) {
        await tx.otInsumo.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
      for (const ins of data.insumos) {
        const costoTotal = ins.cantidad * ins.costoUnitario;
        if (ins.id) {
          await tx.otInsumo.update({
            where: { id: ins.id },
            data: {
              itemInventarioId: ins.itemInventarioId,
              cantidad: ins.cantidad,
              unidadMedida: ins.unidadMedida || null,
              costoUnitario: ins.costoUnitario,
              costoTotal,
            },
          });
        } else {
          await tx.otInsumo.create({
            data: {
              otId: id,
              itemInventarioId: ins.itemInventarioId,
              cantidad: ins.cantidad,
              unidadMedida: ins.unidadMedida || null,
              costoUnitario: ins.costoUnitario,
              costoTotal,
            },
          });
        }
      }
    });
    revalidatePath(`/ordenes-trabajo/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function cerrarOT(id: number): Promise<OtActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const userName = userNameFromSession(session) ?? "";

  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!ot) return { ok: false, error: "not_found" };
  if (!otIsActiva(ot.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const guard = await tx.ordenTrabajo.updateMany({
        where: { id, estado: "En Curso" },
        data: { estado: "Cerrada", fechaFinalizacion: new Date() },
      });
      if (guard.count === 0) {
        throw new Error("wrong_estado");
      }
      const insumos = await tx.otInsumo.findMany({
        where: { otId: id, cantidad: { gt: 0 } },
        include: {
          item: {
            select: {
              id: true,
              descripcion: true,
              stock: true,
              valorUnitario: true,
              unidadMedida: true,
            },
          },
        },
      });
      for (const ins of insumos) {
        await tx.inventarioMovimiento.create({
          data: {
            idItem: ins.itemInventarioId,
            tipo: "salida",
            cantidad: ins.cantidad,
            unidadMedida: ins.unidadMedida || ins.item.unidadMedida,
            valorUnitario: ins.costoUnitario,
            fecha: new Date(),
            usuario: userName,
            moduloOrigen: "ot",
            idOrigen: id,
          },
        });
        const newStock = ins.item.stock - ins.cantidad;
        await tx.inventario.update({
          where: { id: ins.itemInventarioId },
          data: {
            stock: newStock,
            valorTotal: newStock * ins.item.valorUnitario,
          },
        });
      }
    });
    revalidatePath("/ordenes-trabajo");
    revalidatePath(`/ordenes-trabajo/${id}`);
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Error && err.message === "wrong_estado") {
      return { ok: false, error: "wrong_estado" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function cancelarOT(id: number): Promise<OtActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!ot) return { ok: false, error: "not_found" };
  if (!otIsActiva(ot.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  try {
    const guard = await prisma.ordenTrabajo.updateMany({
      where: { id, estado: "En Curso" },
      data: { estado: "Cancelada", fechaFinalizacion: new Date() },
    });
    if (guard.count === 0) {
      return { ok: false, error: "wrong_estado" };
    }
    revalidatePath("/ordenes-trabajo");
    revalidatePath(`/ordenes-trabajo/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
