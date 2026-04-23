"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession } from "@/lib/rbac";
import {
  ADMIN_ALL,
  PERMISOS_CATALOG,
  isValidCodigo,
} from "@/lib/permisos/catalog";

import type { ActionResult } from "../../types";

const inputSchema = z.object({
  rolId: z.number().int().positive(),
  codigos: z.array(z.string().min(1)).max(PERMISOS_CATALOG.length),
});

/**
 * Replaces a rol's permisos with the provided list.
 *
 * Guards:
 *  - caller must have `listados.roles.manage`
 *  - every codigo must exist in the seeded catalog
 *  - `Administrador` rol is locked — its permisos are fixed at seed time
 *  - cannot strip the last `admin.all` holder (would leave the system with no
 *    admins). Computed as: there must remain at least one `estado='activo'`
 *    usuario whose rol still holds `admin.all` after the save.
 */
export async function updateRolPermisos(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "listados.roles.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const { rolId, codigos } = parsed.data;

  for (const codigo of codigos) {
    if (!isValidCodigo(codigo)) {
      return { ok: false, error: "unknown_codigo" };
    }
  }

  const rol = await prisma.rol.findUnique({ where: { id: rolId } });
  if (!rol) return { ok: false, error: "not_found" };

  if (rol.nombre === "Administrador") {
    return { ok: false, error: "admin_locked" };
  }

  // Last-admin guard: if this save would remove admin.all from a rol whose
  // users would otherwise be the only admins, refuse.
  const wouldHoldAdminAll = codigos.includes(ADMIN_ALL);
  if (!wouldHoldAdminAll) {
    const currentlyHasAdmin = await prisma.rolPermiso.findFirst({
      where: { rolId, permiso: { codigo: ADMIN_ALL } },
    });
    if (currentlyHasAdmin) {
      const otherAdminUsers = await prisma.usuario.count({
        where: {
          estado: "activo",
          rolId: { not: rolId },
          rol: { permisos: { some: { permiso: { codigo: ADMIN_ALL } } } },
        },
      });
      if (otherAdminUsers === 0) {
        return { ok: false, error: "last_admin_guarded" };
      }
    }
  }

  const permisoRows = await prisma.permiso.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true },
  });
  const targetPermisoIds = new Set(permisoRows.map((p) => p.id));
  const createdById = userIdFromSession(session);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.rolPermiso.findMany({
      where: { rolId },
      select: { permisoId: true },
    });
    const existingIds = new Set(existing.map((e) => e.permisoId));

    const toRemove = [...existingIds].filter((id) => !targetPermisoIds.has(id));
    const toAdd = [...targetPermisoIds].filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      await tx.rolPermiso.deleteMany({
        where: { rolId, permisoId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.rolPermiso.createMany({
        data: toAdd.map((permisoId) => ({ rolId, permisoId, createdById })),
        skipDuplicates: true,
      });
    }
    // Touch updatedAt for freshness signals.
    await tx.rol.update({ where: { id: rolId }, data: { updatedAt: new Date() } });
  });

  revalidatePath("/listados/roles");
  revalidatePath(`/listados/roles/${rolId}/permisos`);
  return { ok: true };
}
