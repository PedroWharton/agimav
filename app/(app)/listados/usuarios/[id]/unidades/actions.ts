"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession } from "@/lib/rbac";

export type UnidadesResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid" | "not_found" | "unknown" };

const inputSchema = z.object({
  usuarioId: z.number().int().positive(),
  unidadProductivaIds: z.array(z.number().int().positive()),
});

/**
 * WS-B3 — reemplaza las Unidades Productivas asignadas a un usuario por la
 * lista provista (diff de altas/bajas en una transacción).
 *
 * Requiere `listados.usuarios.manage`. Una lista vacía deja al usuario sin
 * asignaciones, lo que en el scoping equivale a "ve todo" (opt-in).
 */
export async function updateUsuarioUnidades(
  raw: unknown,
): Promise<UnidadesResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.usuarios.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { usuarioId, unidadProductivaIds } = parsed.data;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true },
  });
  if (!usuario) return { ok: false, error: "not_found" };

  const target = new Set(unidadProductivaIds);
  if (target.size > 0) {
    const validas = await prisma.unidadProductiva.count({
      where: { id: { in: [...target] } },
    });
    if (validas !== target.size) return { ok: false, error: "invalid" };
  }

  const createdById = userIdFromSession(session);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.usuarioUnidadProductiva.findMany({
        where: { usuarioId },
        select: { unidadProductivaId: true },
      });
      const existingIds = new Set(existing.map((e) => e.unidadProductivaId));

      const toRemove = [...existingIds].filter((id) => !target.has(id));
      const toAdd = [...target].filter((id) => !existingIds.has(id));

      if (toRemove.length > 0) {
        await tx.usuarioUnidadProductiva.deleteMany({
          where: { usuarioId, unidadProductivaId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.usuarioUnidadProductiva.createMany({
          data: toAdd.map((unidadProductivaId) => ({
            usuarioId,
            unidadProductivaId,
            createdById,
          })),
          skipDuplicates: true,
        });
      }
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/usuarios");
  revalidatePath(`/listados/usuarios/${usuarioId}/unidades`);
  return { ok: true };
}
