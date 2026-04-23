"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession } from "@/lib/rbac";

import type { ActionResult } from "./types";

const schema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(120),
  estado: z.enum(["activo", "inactivo"]),
  unidadMedicion: z.string().trim().max(40).nullable().optional(),
  abrevUnidad: z.string().trim().max(10).nullable().optional(),
});

export async function createMaquinariaTipo(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.maquinariaTipo.create({
      data: {
        nombre: parsed.data.nombre,
        estado: parsed.data.estado,
        unidadMedicion: emptyToNull(parsed.data.unidadMedicion),
        abrevUnidad: emptyToNull(parsed.data.abrevUnidad),
        createdById: userIdFromSession(session),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "duplicate",
        fieldErrors: { nombre: "duplicate" },
      };
    }
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/maquinaria/tipos");
  revalidatePath("/maquinaria");
  return { ok: true };
}

export async function updateMaquinariaTipo(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.maquinariaTipo.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        estado: parsed.data.estado,
        unidadMedicion: emptyToNull(parsed.data.unidadMedicion),
        abrevUnidad: emptyToNull(parsed.data.abrevUnidad),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "duplicate",
        fieldErrors: { nombre: "duplicate" },
      };
    }
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/maquinaria/tipos");
  revalidatePath(`/maquinaria/tipos/${id}/estructura`);
  revalidatePath("/maquinaria");
  return { ok: true };
}

export async function deleteMaquinariaTipo(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const usageCount = await prisma.maquinaria.count({ where: { typeId: id } });
  if (usageCount > 0) {
    return { ok: false, error: "in_use", usageCount };
  }

  try {
    await prisma.maquinariaTipo.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/maquinaria/tipos");
  revalidatePath("/maquinaria");
  return { ok: true };
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
