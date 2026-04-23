"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession, ADMIN_ROL } from "@/lib/rbac";

import type { MutationResult } from "./types";

// Invite tokens expire 14 days after mint. Admins can regenerate at will.
const INVITE_TTL_DAYS = 14;

const baseSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  email: z.string().trim().toLowerCase().email("Email inválido").max(200),
  rolId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
});

function mintToken(): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

export async function createUsuario(raw: unknown): Promise<MutationResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.usuarios.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { nombre, email, rolId } = parsed.data;
  const { token, expiresAt } = mintToken();
  const createdById = userIdFromSession(session);

  try {
    await prisma.usuario.create({
      data: {
        nombre,
        email,
        rolId: rolId ?? null,
        estado: "activo",
        createdById,
        inviteTokens: {
          create: {
            token,
            expiresAt,
            createdById,
          },
        },
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "duplicate_email", fieldErrors: { email: "Email en uso" } };
    }
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/usuarios");
  return { ok: true, invite: { token, expiresAt: expiresAt.toISOString() } };
}

export async function updateUsuario(
  id: number,
  raw: unknown,
): Promise<MutationResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.usuarios.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { nombre, email, rolId } = parsed.data;

  try {
    await prisma.usuario.update({
      where: { id },
      data: { nombre, email, rolId: rolId ?? null },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "duplicate_email", fieldErrors: { email: "Email en uso" } };
    }
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/usuarios");
  return { ok: true };
}

/// Mint a fresh invite link for an existing user. Invalidates any outstanding
/// unused tokens so only the most recent link works.
export async function regenerateInvite(id: number): Promise<MutationResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.usuarios.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const target = await prisma.usuario.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "not_found" };

  const { token, expiresAt } = mintToken();
  const createdById = userIdFromSession(session);
  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.usuarioInviteToken.updateMany({
        where: { usuarioId: id, usedAt: null },
        data: { usedAt: now },
      }),
      prisma.usuarioInviteToken.create({
        data: { token, usuarioId: id, expiresAt, createdById },
      }),
    ]);
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/usuarios");
  return { ok: true, invite: { token, expiresAt: expiresAt.toISOString() } };
}

export async function deactivateUsuario(id: number): Promise<MutationResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.usuarios.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const currentUserId = userIdFromSession(session);
  if (currentUserId === id) {
    return { ok: false, error: "no_self_deactivate" };
  }

  const target = await prisma.usuario.findUnique({
    where: { id },
    include: { rol: true },
  });
  if (!target) return { ok: false, error: "not_found" };

  if (target.rol?.nombre === ADMIN_ROL && target.estado === "activo") {
    const activeAdmins = await prisma.usuario.count({
      where: {
        estado: "activo",
        rol: { nombre: ADMIN_ROL },
      },
    });
    if (activeAdmins <= 1) {
      return { ok: false, error: "last_admin" };
    }
  }

  try {
    await prisma.usuario.update({ where: { id }, data: { estado: "inactivo" } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/usuarios");
  return { ok: true };
}

export async function reactivateUsuario(id: number): Promise<MutationResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.usuarios.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.usuario.update({ where: { id }, data: { estado: "activo" } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/usuarios");
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
