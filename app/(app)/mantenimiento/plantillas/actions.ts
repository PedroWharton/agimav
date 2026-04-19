"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  isAdmin,
  requireAuthenticated,
  userNameFromSession,
} from "@/lib/rbac";
import { MANT_PRIORIDADES } from "@/lib/mantenimiento/estado";

export const FRECUENCIA_UNIDADES = ["horas", "dias", "meses"] as const;
export type FrecuenciaUnidad = (typeof FRECUENCIA_UNIDADES)[number];

export type PlantillaActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "in_use"
        | "duplicate"
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

const insumoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  itemInventarioId: z.coerce.number().int().positive(),
  cantidadSugerida: z.coerce.number().min(0).default(0),
  unidadMedida: z.string().trim().max(50).default(""),
});

const tareaSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  descripcion: z.string().trim().min(1).max(500),
});

const plantillaSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  tipoMaquinariaId: z.coerce.number().int().positive(),
  frecuenciaValor: z.coerce.number().positive(),
  frecuenciaUnidad: z.enum(FRECUENCIA_UNIDADES),
  prioridad: z.enum(MANT_PRIORIDADES).default("Media"),
  descripcion: optionalText(2000),
  insumos: z.array(insumoSchema).default([]),
  tareas: z.array(tareaSchema).default([]),
});

export async function createPlantilla(
  raw: unknown,
): Promise<PlantillaActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = plantillaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;
  const userName = userNameFromSession(session);

  const existing = await prisma.plantillaMantenimiento.findUnique({
    where: { nombre: data.nombre },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "duplicate",
      fieldErrors: { nombre: "Ya existe una plantilla con ese nombre." },
    };
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const plant = await tx.plantillaMantenimiento.create({
        data: {
          nombre: data.nombre,
          tipoMaquinariaId: data.tipoMaquinariaId,
          frecuenciaValor: data.frecuenciaValor,
          frecuenciaUnidad: data.frecuenciaUnidad,
          prioridad: data.prioridad,
          descripcion: data.descripcion,
          creadoPor: userName,
        },
      });
      if (data.insumos.length > 0) {
        await tx.plantillaInsumo.createMany({
          data: data.insumos.map((i) => ({
            plantillaId: plant.id,
            itemInventarioId: i.itemInventarioId,
            cantidadSugerida: i.cantidadSugerida,
            unidadMedida: i.unidadMedida,
          })),
        });
      }
      if (data.tareas.length > 0) {
        await tx.plantillaTarea.createMany({
          data: data.tareas.map((t, idx) => ({
            plantillaId: plant.id,
            descripcion: t.descripcion,
            orden: idx,
          })),
        });
      }
      return plant.id;
    });
    revalidatePath("/mantenimiento/plantillas");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function updatePlantilla(
  id: number,
  raw: unknown,
): Promise<PlantillaActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.plantillaMantenimiento.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const parsed = plantillaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  if (data.nombre !== existing.nombre) {
    const dup = await prisma.plantillaMantenimiento.findUnique({
      where: { nombre: data.nombre },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      return {
        ok: false,
        error: "duplicate",
        fieldErrors: { nombre: "Ya existe una plantilla con ese nombre." },
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.plantillaMantenimiento.update({
        where: { id },
        data: {
          nombre: data.nombre,
          tipoMaquinariaId: data.tipoMaquinariaId,
          frecuenciaValor: data.frecuenciaValor,
          frecuenciaUnidad: data.frecuenciaUnidad,
          prioridad: data.prioridad,
          descripcion: data.descripcion,
        },
      });

      // Insumos: upsert + delete-missing
      const existingInsumos = await tx.plantillaInsumo.findMany({
        where: { plantillaId: id },
        select: { id: true },
      });
      const keepInsumoIds = new Set<number>(
        data.insumos
          .map((l) => l.id)
          .filter((v): v is number => typeof v === "number"),
      );
      const toDeleteInsumos = existingInsumos
        .map((l) => l.id)
        .filter((lineId) => !keepInsumoIds.has(lineId));
      if (toDeleteInsumos.length > 0) {
        await tx.plantillaInsumo.deleteMany({
          where: { id: { in: toDeleteInsumos } },
        });
      }
      for (const ins of data.insumos) {
        if (ins.id) {
          await tx.plantillaInsumo.update({
            where: { id: ins.id },
            data: {
              itemInventarioId: ins.itemInventarioId,
              cantidadSugerida: ins.cantidadSugerida,
              unidadMedida: ins.unidadMedida,
            },
          });
        } else {
          await tx.plantillaInsumo.create({
            data: {
              plantillaId: id,
              itemInventarioId: ins.itemInventarioId,
              cantidadSugerida: ins.cantidadSugerida,
              unidadMedida: ins.unidadMedida,
            },
          });
        }
      }

      // Tareas: upsert + delete-missing + keep orden by index
      const existingTareas = await tx.plantillaTarea.findMany({
        where: { plantillaId: id },
        select: { id: true },
      });
      const keepTareaIds = new Set<number>(
        data.tareas
          .map((l) => l.id)
          .filter((v): v is number => typeof v === "number"),
      );
      const toDeleteTareas = existingTareas
        .map((l) => l.id)
        .filter((lineId) => !keepTareaIds.has(lineId));
      if (toDeleteTareas.length > 0) {
        await tx.plantillaTarea.deleteMany({
          where: { id: { in: toDeleteTareas } },
        });
      }
      for (const [idx, t] of data.tareas.entries()) {
        if (t.id) {
          await tx.plantillaTarea.update({
            where: { id: t.id },
            data: { descripcion: t.descripcion, orden: idx },
          });
        } else {
          await tx.plantillaTarea.create({
            data: {
              plantillaId: id,
              descripcion: t.descripcion,
              orden: idx,
            },
          });
        }
      }
    });
    revalidatePath("/mantenimiento/plantillas");
    revalidatePath(`/mantenimiento/plantillas/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function deletePlantilla(
  id: number,
): Promise<PlantillaActionResult> {
  const session = await auth();
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };

  const inUse = await prisma.mantenimiento.count({
    where: { plantillaId: id },
  });
  if (inUse > 0) return { ok: false, error: "in_use" };

  try {
    await prisma.plantillaMantenimiento.delete({ where: { id } });
    revalidatePath("/mantenimiento/plantillas");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

const aplicarSchema = z.object({
  maquinariaId: z.coerce.number().int().positive(),
  responsableId: z.coerce.number().int().positive(),
  unidadProductivaId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  fechaProgramada: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
});

export async function aplicarPlantilla(
  plantillaId: number,
  raw: unknown,
): Promise<PlantillaActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = aplicarSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  const plantilla = await prisma.plantillaMantenimiento.findUnique({
    where: { id: plantillaId },
    include: {
      insumos: {
        include: {
          item: {
            select: { id: true, valorUnitario: true, unidadMedida: true },
          },
        },
      },
      tareas: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
    },
  });
  if (!plantilla) return { ok: false, error: "not_found" };

  const userName = userNameFromSession(session);

  try {
    const id = await prisma.$transaction(async (tx) => {
      const mant = await tx.mantenimiento.create({
        data: {
          tipo: "preventivo",
          maquinariaId: data.maquinariaId,
          prioridad: plantilla.prioridad,
          descripcion: plantilla.descripcion,
          responsableId: data.responsableId,
          unidadProductivaId: data.unidadProductivaId,
          estado: "Pendiente",
          fechaProgramada: data.fechaProgramada,
          plantillaId: plantilla.id,
          frecuenciaValor: plantilla.frecuenciaValor,
          frecuenciaUnidad: plantilla.frecuenciaUnidad,
          creadoPor: userName,
        },
      });
      if (plantilla.insumos.length > 0) {
        await tx.mantenimientoInsumo.createMany({
          data: plantilla.insumos.map((i) => ({
            mantenimientoId: mant.id,
            itemInventarioId: i.itemInventarioId,
            cantidadSugerida: i.cantidadSugerida,
            cantidadUtilizada: 0,
            unidadMedida: i.unidadMedida || (i.item.unidadMedida ?? ""),
            costoUnitario: i.item.valorUnitario,
            costoTotal: 0,
          })),
        });
      }
      if (plantilla.tareas.length > 0) {
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
          valorNuevo: "Pendiente",
          usuario: userName ?? "—",
          detalle: `Generado desde plantilla "${plantilla.nombre}"`,
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
