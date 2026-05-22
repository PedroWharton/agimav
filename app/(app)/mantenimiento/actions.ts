"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMonths } from "date-fns";
import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  requirePermission,
  userNameFromSession,
} from "@/lib/rbac";
import {
  MANT_PRIORIDADES,
  MANT_TIPOS,
  isActivo,
  isTerminal,
} from "@/lib/mantenimiento/estado";

import type { MantActionResult } from "./types";

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

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const createSchema = z.object({
  maquinariaId: z.coerce.number().int().positive(),
  tipo: z.enum(MANT_TIPOS).default("correctivo"),
  estadoInicial: z
    .enum([
      "Pendiente",
      "En Reparación - Chacra",
      "En Reparación - Taller",
      "Finalizado",
    ])
    .default("Pendiente"),
  descripcion: optionalText(2000),
  responsableId: z.coerce.number().int().positive(),
  unidadProductivaId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  fechaProgramada: optionalDate,
  prioridad: z.enum(MANT_PRIORIDADES).default("Media"),
  plantillaId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
});

const insumoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  itemInventarioId: z.coerce.number().int().positive(),
  cantidadSugerida: z.coerce.number().min(0).default(0),
  cantidadUtilizada: z.coerce.number().min(0).default(0),
  unidadMedida: z.string().trim().max(50).default(""),
  costoUnitario: z.coerce.number().min(0).default(0),
  precioPendiente: z.boolean().default(false),
});

const insumosPayloadSchema = z.object({
  lines: z.array(insumoSchema),
});

const tareaSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  descripcion: z.string().trim().min(1).max(500),
  realizada: z.boolean().default(false),
});

const tareasPayloadSchema = z.object({
  lines: z.array(tareaSchema),
});

export async function createMantenimiento(
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.create");
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

  const plantilla = data.plantillaId
    ? await prisma.plantillaMantenimiento.findUnique({
        where: { id: data.plantillaId },
        include: {
          tareas: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        },
      })
    : null;
  if (data.plantillaId && !plantilla) {
    return { ok: false, error: "not_found" };
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const maq = await tx.maquinaria.findUnique({
        where: { id: data.maquinariaId },
        select: { horasAcumuladas: true },
      });
      const now = new Date();
      const estadoInicial = data.estadoInicial;
      const mant = await tx.mantenimiento.create({
        data: {
          tipo: data.tipo,
          maquinariaId: data.maquinariaId,
          prioridad: data.prioridad,
          descripcion: data.descripcion,
          responsableId: data.responsableId,
          unidadProductivaId: data.unidadProductivaId,
          estado: estadoInicial,
          fechaProgramada: data.fechaProgramada,
          fechaInicio: estadoInicial === "Pendiente" ? null : now,
          fechaFinalizacion: estadoInicial === "Finalizado" ? now : null,
          creadoPor: userName,
          plantillaId: plantilla?.id ?? null,
          frecuenciaValor: plantilla?.frecuenciaValor ?? null,
          frecuenciaUnidad: plantilla?.frecuenciaUnidad ?? null,
          horasAcumuladasSnapshot: maq?.horasAcumuladas ?? null,
        },
      });
      if (plantilla && plantilla.tareas.length > 0) {
        await tx.mantenimientoTarea.createMany({
          data: plantilla.tareas.map((t, idx) => ({
            mantenimientoId: mant.id,
            descripcion: t.descripcion,
            realizada: false,
            orden: idx,
            esDePlantilla: true,
          })),
        });
      }
      await tx.mantenimientoHistorial.create({
        data: {
          mantenimientoId: mant.id,
          tipoCambio: "estado",
          valorAnterior: null,
          valorNuevo: estadoInicial,
          usuario: userName ?? "—",
          detalle: plantilla
            ? `Generado desde plantilla "${plantilla.nombre}"`
            : null,
        },
      });
      return mant.id;
    });
    revalidatePath("/mantenimiento");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const updateHeaderSchema = z.object({
  descripcion: optionalText(2000),
  responsableId: z.coerce.number().int().positive(),
  unidadProductivaId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  tallerAsignadoId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  fechaProgramada: optionalDate,
  prioridad: z.enum(MANT_PRIORIDADES).default("Media"),
  programarRevision: z.boolean().default(false),
  fechaProximaRevision: optionalDate,
  descripcionRevision: optionalText(500),
});

export async function updateMantenimientoHeader(
  id: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.mantenimiento.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      responsable: { select: { nombre: true } },
      tallerAsignado: { select: { nombre: true } },
      responsableId: true,
      tallerAsignadoId: true,
    },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (isTerminal(existing.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  const parsed = updateHeaderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;
  const userName = userNameFromSession(session) ?? "—";

  try {
    await prisma.$transaction(async (tx) => {
      const historial: Array<{
        tipoCambio: string;
        valorAnterior: string | null;
        valorNuevo: string | null;
      }> = [];

      if (existing.responsableId !== data.responsableId) {
        const nuevo = await tx.usuario.findUnique({
          where: { id: data.responsableId },
          select: { nombre: true },
        });
        historial.push({
          tipoCambio: "responsable",
          valorAnterior: existing.responsable?.nombre ?? null,
          valorNuevo: nuevo?.nombre ?? null,
        });
      }
      if (existing.tallerAsignadoId !== data.tallerAsignadoId) {
        const nuevo = data.tallerAsignadoId
          ? await tx.unidadProductiva.findUnique({
              where: { id: data.tallerAsignadoId },
              select: { nombre: true },
            })
          : null;
        historial.push({
          tipoCambio: "taller",
          valorAnterior: existing.tallerAsignado?.nombre ?? null,
          valorNuevo: nuevo?.nombre ?? null,
        });
      }

      await tx.mantenimiento.update({
        where: { id },
        data: {
          descripcion: data.descripcion,
          responsableId: data.responsableId,
          unidadProductivaId: data.unidadProductivaId,
          tallerAsignadoId: data.tallerAsignadoId,
          fechaProgramada: data.fechaProgramada,
          prioridad: data.prioridad,
          programarRevision: data.programarRevision,
          fechaProximaRevision: data.fechaProximaRevision,
          descripcionRevision: data.descripcionRevision,
        },
      });

      for (const h of historial) {
        await tx.mantenimientoHistorial.create({
          data: {
            mantenimientoId: id,
            tipoCambio: h.tipoCambio,
            valorAnterior: h.valorAnterior,
            valorNuevo: h.valorNuevo,
            usuario: userName,
          },
        });
      }
    });
    revalidatePath("/mantenimiento");
    revalidatePath(`/mantenimiento/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const transitionSchema = z.object({
  target: z.enum([
    "En Reparación - Chacra",
    "En Reparación - Taller",
    "Finalizado",
    "Cancelado",
  ]),
  tallerAsignadoId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  programarRevision: z.boolean().default(false),
  fechaProximaRevision: optionalDate,
  descripcionRevision: optionalText(500),
});

export async function transitionEstado(
  id: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const { target } = parsed.data;

  if (target === "Cancelado" && !hasPermission(session, "mantenimiento.cancel")) {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.mantenimiento.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      tallerAsignadoId: true,
      tallerAsignado: { select: { nombre: true } },
      maquinariaId: true,
      responsableId: true,
    },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const valid = validateTransition(existing.estado, target);
  if (!valid) return { ok: false, error: "wrong_estado" };

  const userName = userNameFromSession(session) ?? "—";
  const now = new Date();

  try {
    const updateData: Record<string, unknown> = { estado: target };

    if (target === "En Reparación - Chacra" || target === "En Reparación - Taller") {
      updateData.fechaInicio = now;
      if (target === "En Reparación - Taller" && parsed.data.tallerAsignadoId) {
        updateData.tallerAsignadoId = parsed.data.tallerAsignadoId;
      }
      if (target === "En Reparación - Chacra") {
        updateData.tallerAsignadoId = null;
      }
    }
    if (target === "Finalizado" || target === "Cancelado") {
      updateData.fechaFinalizacion = now;
    }
    if (target === "Finalizado" && parsed.data.programarRevision) {
      updateData.programarRevision = true;
      updateData.fechaProximaRevision = parsed.data.fechaProximaRevision;
      updateData.descripcionRevision = parsed.data.descripcionRevision;
    }

    await prisma.$transaction(async (tx) => {
      const guard = await tx.mantenimiento.updateMany({
        where: {
          id,
          estado: { in: ["Pendiente", "En Reparación - Chacra", "En Reparación - Taller"] },
        },
        data: updateData,
      });
      if (guard.count === 0) {
        throw new Error("wrong_estado");
      }

      await tx.mantenimientoHistorial.create({
        data: {
          mantenimientoId: id,
          tipoCambio: "estado",
          valorAnterior: existing.estado,
          valorNuevo: target,
          usuario: userName,
        },
      });

      if (target === "En Reparación - Taller" && parsed.data.tallerAsignadoId) {
        const taller = await tx.unidadProductiva.findUnique({
          where: { id: parsed.data.tallerAsignadoId },
          select: { nombre: true },
        });
        await tx.mantenimientoHistorial.create({
          data: {
            mantenimientoId: id,
            tipoCambio: "taller",
            valorAnterior: existing.tallerAsignado?.nombre ?? null,
            valorNuevo: taller?.nombre ?? null,
            usuario: userName,
          },
        });
      }

      if (target === "Finalizado") {
        await commitInsumosConsumption(tx, id, userName);

        if (parsed.data.programarRevision && parsed.data.fechaProximaRevision) {
          // WS-D: a programmed revision is a row on the same mantenimiento,
          // not a new child record.
          await tx.mantenimientoRevision.create({
            data: {
              mantenimientoId: id,
              fechaProgramada: parsed.data.fechaProximaRevision,
              descripcion: parsed.data.descripcionRevision,
              estado: "pendiente",
            },
          });
          await tx.mantenimientoHistorial.create({
            data: {
              mantenimientoId: id,
              tipoCambio: "revision",
              valorAnterior: null,
              valorNuevo: null,
              usuario: userName,
              detalle: "Revisión programada",
            },
          });
        }
      }
    });
    revalidatePath("/mantenimiento");
    revalidatePath(`/mantenimiento/${id}`);
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Error && err.message === "wrong_estado") {
      return { ok: false, error: "wrong_estado" };
    }
    return { ok: false, error: "unknown" };
  }
}

async function commitInsumosConsumption(
  tx: Prisma.TransactionClient,
  mantenimientoId: number,
  userName: string,
): Promise<void> {
  const insumos = await tx.mantenimientoInsumo.findMany({
    where: { mantenimientoId, cantidadUtilizada: { gt: 0 } },
    include: {
      item: { select: { id: true, descripcion: true, stock: true, valorUnitario: true, unidadMedida: true } },
    },
  });
  for (const ins of insumos) {
    await tx.inventarioMovimiento.create({
      data: {
        idItem: ins.itemInventarioId,
        tipo: "salida",
        cantidad: ins.cantidadUtilizada,
        unidadMedida: ins.unidadMedida || ins.item.unidadMedida,
        valorUnitario: ins.costoUnitario,
        fecha: new Date(),
        usuario: userName,
        moduloOrigen: "mantenimiento",
        idOrigen: mantenimientoId,
      },
    });
    const newStock = ins.item.stock - ins.cantidadUtilizada;
    await tx.inventario.update({
      where: { id: ins.itemInventarioId },
      data: {
        stock: newStock,
        valorTotal: newStock * ins.item.valorUnitario,
      },
    });
    await tx.mantenimientoHistorial.create({
      data: {
        mantenimientoId,
        tipoCambio: "insumo",
        valorAnterior: null,
        valorNuevo: null,
        detalle: `consumido: ${ins.item.descripcion ?? ins.itemInventarioId} x ${ins.cantidadUtilizada}`,
        usuario: userName,
      },
    });
  }
}

function validateTransition(from: string, to: string): boolean {
  if (to === "Cancelado") {
    return isActivo(from);
  }
  if (to === "En Reparación - Chacra") {
    return from === "Pendiente" || from === "En Reparación - Taller";
  }
  if (to === "En Reparación - Taller") {
    return from === "Pendiente" || from === "En Reparación - Chacra";
  }
  if (to === "Finalizado") {
    return from === "En Reparación - Chacra" || from === "En Reparación - Taller";
  }
  return false;
}

export async function saveInsumos(
  id: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.mantenimiento.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (isTerminal(existing.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  const parsed = insumosPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const { lines } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existingLines = await tx.mantenimientoInsumo.findMany({
        where: { mantenimientoId: id },
        select: { id: true },
      });
      const keepIds = new Set<number>(
        lines
          .map((l) => l.id)
          .filter((v): v is number => typeof v === "number"),
      );
      const toDelete = existingLines
        .map((l) => l.id)
        .filter((lineId) => !keepIds.has(lineId));
      if (toDelete.length > 0) {
        await tx.mantenimientoInsumo.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      for (const line of lines) {
        if (line.id) {
          await tx.mantenimientoInsumo.update({
            where: { id: line.id },
            data: {
              itemInventarioId: line.itemInventarioId,
              cantidadSugerida: line.cantidadSugerida,
              cantidadUtilizada: line.cantidadUtilizada,
              unidadMedida: line.unidadMedida,
              costoUnitario: line.costoUnitario,
              costoTotal: line.precioPendiente
                ? 0
                : line.cantidadUtilizada * line.costoUnitario,
              precioPendiente: line.precioPendiente,
            },
          });
        } else {
          await tx.mantenimientoInsumo.create({
            data: {
              mantenimientoId: id,
              itemInventarioId: line.itemInventarioId,
              cantidadSugerida: line.cantidadSugerida,
              cantidadUtilizada: line.cantidadUtilizada,
              unidadMedida: line.unidadMedida,
              costoUnitario: line.costoUnitario,
              costoTotal: line.precioPendiente
                ? 0
                : line.cantidadUtilizada * line.costoUnitario,
              precioPendiente: line.precioPendiente,
            },
          });
        }
      }
    });
    revalidatePath(`/mantenimiento/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function saveTareas(
  id: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.mantenimiento.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (isTerminal(existing.estado)) {
    return { ok: false, error: "wrong_estado" };
  }

  const parsed = tareasPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingLines = await tx.mantenimientoTarea.findMany({
        where: { mantenimientoId: id },
        select: { id: true },
      });
      const keepIds = new Set<number>(
        parsed.data.lines
          .map((l) => l.id)
          .filter((v): v is number => typeof v === "number"),
      );
      const toDelete = existingLines
        .map((l) => l.id)
        .filter((lineId) => !keepIds.has(lineId));
      if (toDelete.length > 0) {
        await tx.mantenimientoTarea.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
      for (const [idx, line] of parsed.data.lines.entries()) {
        if (line.id) {
          await tx.mantenimientoTarea.update({
            where: { id: line.id },
            data: {
              descripcion: line.descripcion,
              realizada: line.realizada,
              orden: idx,
            },
          });
        } else {
          await tx.mantenimientoTarea.create({
            data: {
              mantenimientoId: id,
              descripcion: line.descripcion,
              realizada: line.realizada,
              orden: idx,
            },
          });
        }
      }
    });
    revalidatePath(`/mantenimiento/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const observacionSchema = z.object({
  texto: z.string().trim().min(1).max(2000),
});

export async function addObservacion(
  id: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.mantenimiento.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const parsed = observacionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const userName = userNameFromSession(session) ?? "—";

  try {
    await prisma.mantenimientoHistorial.create({
      data: {
        mantenimientoId: id,
        tipoCambio: "observacion",
        detalle: parsed.data.texto,
        usuario: userName,
      },
    });
    revalidatePath(`/mantenimiento/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

// ─── Revisiones (WS-D) ─────────────────────────────────────────────────
// Una revisión es una fila sobre el mismo mantenimiento, no un registro hijo.

const requiredDate = z
  .string()
  .trim()
  .min(1)
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Fecha inválida" });

const repetirSchema = z.object({
  cantidad: z.coerce.number().int().min(1).max(60),
  cadaValor: z.coerce.number().int().min(1).max(365),
  cadaUnidad: z.enum(["dias", "meses"]),
});

const agregarRevisionesSchema = z.object({
  fechaProgramada: requiredDate,
  descripcion: optionalText(500),
  repetir: repetirSchema
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export async function agregarRevisiones(
  id: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.mantenimiento.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const parsed = agregarRevisionesSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;
  const userName = userNameFromSession(session) ?? "—";

  // Build the list of dates: the base date plus N-1 spaced repetitions.
  const fechas: Date[] = [data.fechaProgramada];
  if (data.repetir) {
    for (let i = 1; i < data.repetir.cantidad; i++) {
      const prev = fechas[i - 1];
      fechas.push(
        data.repetir.cadaUnidad === "meses"
          ? addMonths(prev, data.repetir.cadaValor)
          : addDays(prev, data.repetir.cadaValor),
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.mantenimientoRevision.createMany({
        data: fechas.map((f) => ({
          mantenimientoId: id,
          fechaProgramada: f,
          descripcion: data.descripcion,
          estado: "pendiente",
        })),
      });
      await tx.mantenimientoHistorial.create({
        data: {
          mantenimientoId: id,
          tipoCambio: "revision",
          valorAnterior: null,
          valorNuevo: null,
          usuario: userName,
          detalle:
            fechas.length === 1
              ? "Revisión agregada"
              : `${fechas.length} revisiones agregadas`,
        },
      });
    });
    revalidatePath(`/mantenimiento/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const marcarRevisionSchema = z.object({
  hecha: z.boolean().default(true),
});

export async function marcarRevisionHecha(
  revisionId: number,
  raw: unknown,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = marcarRevisionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const rev = await prisma.mantenimientoRevision.findUnique({
    where: { id: revisionId },
    select: { id: true, mantenimientoId: true },
  });
  if (!rev) return { ok: false, error: "not_found" };

  const userName = userNameFromSession(session) ?? "—";
  const { hecha } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.mantenimientoRevision.update({
        where: { id: revisionId },
        data: {
          estado: hecha ? "hecha" : "pendiente",
          fechaRealizada: hecha ? new Date() : null,
        },
      });
      if (hecha) {
        await tx.mantenimientoHistorial.create({
          data: {
            mantenimientoId: rev.mantenimientoId,
            tipoCambio: "revision",
            valorAnterior: null,
            valorNuevo: null,
            usuario: userName,
            detalle: "Revisión marcada como realizada",
          },
        });
      }
    });
    revalidatePath(`/mantenimiento/${rev.mantenimientoId}`);
    return { ok: true, id: rev.mantenimientoId };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function eliminarRevision(
  revisionId: number,
): Promise<MantActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const rev = await prisma.mantenimientoRevision.findUnique({
    where: { id: revisionId },
    select: { mantenimientoId: true },
  });
  if (!rev) return { ok: false, error: "not_found" };

  try {
    await prisma.mantenimientoRevision.delete({ where: { id: revisionId } });
    revalidatePath(`/mantenimiento/${rev.mantenimientoId}`);
    return { ok: true, id: rev.mantenimientoId };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
