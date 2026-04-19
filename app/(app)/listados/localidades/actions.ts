"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin, userIdFromSession } from "@/lib/rbac";

import type { ActionResult } from "./types";

const schema = z.object({
  nombre: z.string().trim().min(1).max(100),
});

export async function createLocalidad(raw: unknown): Promise<ActionResult> {
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
    await prisma.localidad.create({
      data: { nombre: parsed.data.nombre, createdById: userIdFromSession(session) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/localidades");
  return { ok: true };
}

export async function updateLocalidad(id: number, raw: unknown): Promise<ActionResult> {
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
    await prisma.localidad.update({ where: { id }, data: { nombre: parsed.data.nombre } });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/localidades");
  return { ok: true };
}

export async function deleteLocalidad(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const [unidades, proveedores, ots] = await Promise.all([
    prisma.unidadProductiva.count({ where: { localidadId: id } }),
    prisma.proveedor.count({ where: { localidadId: id } }),
    prisma.ordenTrabajo.count({ where: { localidadId: id } }),
  ]);
  const usageCount = unidades + proveedores + ots;
  if (usageCount > 0) {
    return { ok: false, error: "in_use", usageCount };
  }

  try {
    await prisma.localidad.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/localidades");
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
