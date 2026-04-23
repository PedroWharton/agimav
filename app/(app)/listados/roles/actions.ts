"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession } from "@/lib/rbac";

import type { ActionResult } from "./types";

const rolSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
});

export async function createRol(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.roles.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = rolSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.rol.create({
      data: { nombre: parsed.data.nombre, createdById: userIdFromSession(session) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/roles");
  return { ok: true };
}

export async function updateRol(id: number, raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.roles.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = rolSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.rol.update({ where: { id }, data: { nombre: parsed.data.nombre } });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/roles");
  return { ok: true };
}

export async function deleteRol(id: number): Promise<ActionResult & { usuariosCount?: number }> {
  const session = await auth();
  try {
    requirePermission(session, "listados.roles.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const usuariosCount = await prisma.usuario.count({ where: { rolId: id } });
  if (usuariosCount > 0) {
    return { ok: false, error: "in_use", usuariosCount };
  }

  try {
    await prisma.rol.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/roles");
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
