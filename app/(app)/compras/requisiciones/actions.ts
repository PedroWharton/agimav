"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  isAdmin,
  requireAuthenticated,
  userNameFromSession,
} from "@/lib/rbac";

import type { RequisicionActionResult } from "./types";

const PRIORIDADES = ["Normal", "Urgente"] as const;

const detalleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  itemId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().positive(),
  prioridadItem: z.enum(PRIORIDADES).default("Normal"),
  notasItem: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null)));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const headerSchema = z.object({
  solicitante: z.string().trim().min(1, "Obligatorio").max(120),
  unidadProductiva: z.string().trim().min(1, "Obligatorio").max(120),
  localidad: z.string().trim().min(1, "Obligatorio").max(120),
  prioridad: z.enum(PRIORIDADES).default("Normal"),
  fechaTentativa: optionalDate,
  fechaLimite: optionalDate,
  notas: optionalText(2000),
});

const createSchema = headerSchema.extend({
  detalle: z.array(detalleSchema),
});

const updateSchema = createSchema;

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function canMutate(
  session: Session | null,
  requisicion: { creadoPor: string | null; estado: string },
): boolean {
  if (!session?.user) return false;
  if (requisicion.estado !== "Borrador") return false;
  if (isAdmin(session)) return true;
  const name = userNameFromSession(session);
  return !!name && !!requisicion.creadoPor && name === requisicion.creadoPor;
}

export async function createRequisicion(
  raw: unknown,
): Promise<RequisicionActionResult> {
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
  const creadoPor = userNameFromSession(session);

  try {
    const id = await prisma.$transaction(async (tx) => {
      const req = await tx.requisicion.create({
        data: {
          solicitante: data.solicitante,
          unidadProductiva: data.unidadProductiva,
          localidad: data.localidad,
          prioridad: data.prioridad,
          estado: "Borrador",
          fechaTentativa: data.fechaTentativa,
          fechaLimite: data.fechaLimite,
          notas: data.notas,
          creadoPor,
        },
      });
      if (data.detalle.length > 0) {
        await tx.requisicionDetalle.createMany({
          data: data.detalle.map((d) => ({
            requisicionId: req.id,
            itemId: d.itemId,
            cantidad: d.cantidad,
            prioridadItem: d.prioridadItem,
            notasItem: d.notasItem,
            estado: "Pendiente",
          })),
        });
      }
      return req.id;
    });
    revalidatePath("/compras/requisiciones");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function updateRequisicion(
  id: number,
  raw: unknown,
): Promise<RequisicionActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.requisicion.findUnique({
    where: { id },
    select: { id: true, estado: true, creadoPor: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (!canMutate(session, existing)) {
    if (existing.estado !== "Borrador")
      return { ok: false, error: "wrong_estado" };
    return { ok: false, error: "forbidden" };
  }

  const parsed = updateSchema.safeParse(raw);
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
      await tx.requisicion.update({
        where: { id },
        data: {
          solicitante: data.solicitante,
          unidadProductiva: data.unidadProductiva,
          localidad: data.localidad,
          prioridad: data.prioridad,
          fechaTentativa: data.fechaTentativa,
          fechaLimite: data.fechaLimite,
          notas: data.notas,
        },
      });

      const existingLines = await tx.requisicionDetalle.findMany({
        where: { requisicionId: id },
        select: { id: true },
      });
      const keepIds = new Set<number>(
        data.detalle
          .map((d) => d.id)
          .filter((v): v is number => typeof v === "number"),
      );
      const toDelete = existingLines
        .map((l) => l.id)
        .filter((lineId) => !keepIds.has(lineId));
      if (toDelete.length > 0) {
        await tx.requisicionDetalle.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      for (const d of data.detalle) {
        if (d.id) {
          await tx.requisicionDetalle.update({
            where: { id: d.id },
            data: {
              itemId: d.itemId,
              cantidad: d.cantidad,
              prioridadItem: d.prioridadItem,
              notasItem: d.notasItem,
            },
          });
        } else {
          await tx.requisicionDetalle.create({
            data: {
              requisicionId: id,
              itemId: d.itemId,
              cantidad: d.cantidad,
              prioridadItem: d.prioridadItem,
              notasItem: d.notasItem,
              estado: "Pendiente",
            },
          });
        }
      }
    });
    revalidatePath("/compras/requisiciones");
    revalidatePath(`/compras/requisiciones/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function deleteRequisicion(
  id: number,
): Promise<RequisicionActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.requisicion.findUnique({
    where: { id },
    select: { id: true, estado: true, creadoPor: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (!canMutate(session, existing)) {
    if (existing.estado !== "Borrador")
      return { ok: false, error: "wrong_estado" };
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.requisicion.delete({ where: { id } });
    revalidatePath("/compras/requisiciones");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function submitRequisicion(
  id: number,
): Promise<RequisicionActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.requisicion.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      creadoPor: true,
      _count: { select: { detalle: true } },
    },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (!canMutate(session, existing)) {
    if (existing.estado !== "Borrador")
      return { ok: false, error: "wrong_estado" };
    return { ok: false, error: "forbidden" };
  }
  if (existing._count.detalle === 0) {
    return { ok: false, error: "empty_detalle" };
  }

  try {
    await prisma.requisicion.update({
      where: { id },
      data: { estado: "En Revisión" },
    });
    revalidatePath("/compras/requisiciones");
    revalidatePath(`/compras/requisiciones/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const approveSchema = z.object({
  comentario: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

const rejectSchema = z.object({
  motivo: z.string().trim().min(1, "Obligatorio").max(1000),
});

export async function approveRequisicion(
  id: number,
  raw: unknown,
): Promise<RequisicionActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };

  const existing = await prisma.requisicion.findUnique({
    where: { id },
    select: { id: true, estado: true, notas: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.estado !== "En Revisión")
    return { ok: false, error: "wrong_estado" };

  const parsed = approveSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const aprobadoPor = userNameFromSession(session);
  const now = new Date();
  const comentario = parsed.data.comentario;
  const mergedNotas = comentario
    ? `${existing.notas ? `${existing.notas}\n` : ""}Aprobación (${aprobadoPor ?? "—"} · ${now.toISOString().slice(0, 10)}): ${comentario}`
    : existing.notas;

  try {
    await prisma.requisicion.update({
      where: { id },
      data: {
        estado: "Aprobada",
        fechaAprobacion: now,
        aprobadoPor,
        notas: mergedNotas,
      },
    });
    revalidatePath("/compras/requisiciones");
    revalidatePath(`/compras/requisiciones/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function rejectRequisicion(
  id: number,
  raw: unknown,
): Promise<RequisicionActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };

  const existing = await prisma.requisicion.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.estado !== "En Revisión")
    return { ok: false, error: "wrong_estado" };

  const parsed = rejectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const canceladoPor = userNameFromSession(session);
  try {
    await prisma.requisicion.update({
      where: { id },
      data: {
        estado: "Rechazada",
        fechaCancelacion: new Date(),
        canceladoPor,
        motivoRechazo: parsed.data.motivo,
      },
    });
    revalidatePath("/compras/requisiciones");
    revalidatePath(`/compras/requisiciones/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
