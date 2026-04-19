"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin, userIdFromSession } from "@/lib/rbac";

import type { ActionResult } from "./types";

const schema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  localidadId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  tipoUnidadId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
});

export async function createUnidadProductiva(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.unidadProductiva.create({
      data: {
        nombre: parsed.data.nombre,
        localidadId: parsed.data.localidadId ?? null,
        tipoUnidadId: parsed.data.tipoUnidadId ?? null,
        createdById: userIdFromSession(session),
      },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/unidades-productivas");
  return { ok: true };
}

export async function updateUnidadProductiva(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.unidadProductiva.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        localidadId: parsed.data.localidadId ?? null,
        tipoUnidadId: parsed.data.tipoUnidadId ?? null,
      },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/unidades-productivas");
  return { ok: true };
}

export async function deleteUnidadProductiva(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const [ots, mantUnidad, mantTaller] = await Promise.all([
    prisma.ordenTrabajo.count({ where: { unidadProductivaId: id } }),
    prisma.mantenimiento.count({ where: { unidadProductivaId: id } }),
    prisma.mantenimiento.count({ where: { tallerAsignadoId: id } }),
  ]);
  const usageCount = ots + mantUnidad + mantTaller;
  if (usageCount > 0) {
    return { ok: false, error: "in_use", usageCount };
  }

  try {
    await prisma.unidadProductiva.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/unidades-productivas");
  return { ok: true };
}

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
