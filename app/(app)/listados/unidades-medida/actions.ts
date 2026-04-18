"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin, userIdFromSession } from "@/lib/rbac";

const schema = z.object({
  nombre: z.string().trim().min(1).max(100),
  abreviacion: z.string().trim().min(1).max(20),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; inventarioCount?: number };

export async function createUnidadMedida(raw: unknown): Promise<ActionResult> {
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
    await prisma.unidadMedida.create({
      data: { ...parsed.data, createdById: userIdFromSession(session) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/unidades-medida");
  return { ok: true };
}

export async function updateUnidadMedida(id: number, raw: unknown): Promise<ActionResult> {
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
    await prisma.unidadMedida.update({ where: { id }, data: parsed.data });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/unidades-medida");
  return { ok: true };
}

export async function deleteUnidadMedida(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const target = await prisma.unidadMedida.findUnique({
    where: { id },
    select: { nombre: true },
  });
  if (!target) return { ok: false, error: "unknown" };

  const inventarioCount = await prisma.inventario.count({
    where: { unidadMedida: target.nombre },
  });
  if (inventarioCount > 0) {
    return { ok: false, error: "in_use", inventarioCount };
  }

  try {
    await prisma.unidadMedida.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/unidades-medida");
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
