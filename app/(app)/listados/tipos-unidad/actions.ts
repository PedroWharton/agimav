"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession } from "@/lib/rbac";

import type { ActionResult } from "./types";

const schema = z.object({
  nombre: z.string().trim().min(1).max(100),
});

export async function createTipoUnidad(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.master_data.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.tipoUnidad.create({
      data: { nombre: parsed.data.nombre, createdById: userIdFromSession(session) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/tipos-unidad");
  return { ok: true };
}

export async function updateTipoUnidad(id: number, raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.master_data.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.tipoUnidad.update({ where: { id }, data: { nombre: parsed.data.nombre } });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/tipos-unidad");
  return { ok: true };
}

export async function deleteTipoUnidad(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.master_data.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const unidadesCount = await prisma.unidadProductiva.count({ where: { tipoUnidadId: id } });
  if (unidadesCount > 0) {
    return { ok: false, error: "in_use", unidadesCount };
  }

  try {
    await prisma.tipoUnidad.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/tipos-unidad");
  return { ok: true };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
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
