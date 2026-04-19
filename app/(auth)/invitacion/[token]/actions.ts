"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";

import type { SetPasswordResult } from "./types";

const schema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "errorPasswordCorta").max(200),
    passwordConfirmacion: z.string().min(1),
  })
  .refine((v) => v.password === v.passwordConfirmacion, {
    path: ["passwordConfirmacion"],
    message: "errorPasswordNoCoincide",
  });

export async function setPasswordFromInvite(
  raw: unknown,
): Promise<SetPasswordResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "validation", fieldErrors };
  }

  const { token, password } = parsed.data;
  const record = await prisma.usuarioInviteToken.findUnique({
    where: { token },
    include: { usuario: true },
  });

  if (!record || record.usedAt || record.usuario.estado !== "activo") {
    return { ok: false, error: "invalid" };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: record.usuarioId },
        data: { passwordHash },
      }),
      prisma.usuarioInviteToken.updateMany({
        where: { usuarioId: record.usuarioId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
  } catch {
    return { ok: false, error: "unknown" };
  }

  return { ok: true };
}
