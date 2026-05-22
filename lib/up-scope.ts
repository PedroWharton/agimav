import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { isAdmin, userIdFromSession } from "@/lib/rbac";

/**
 * WS-B3 — scoping row-level por Unidad Productiva.
 *
 * Devuelve los ids de UP que el usuario puede ver, o `null` cuando no hay
 * restricción ("ve todo"):
 *  - admin (`admin.all`)       → null
 *  - usuario sin asignaciones  → null  (opt-in: sin asignar = sin filtro)
 *  - usuario con asignaciones  → array de ids de UP
 *
 * Uso típico en un listado de Mantenimiento u OrdenTrabajo:
 *
 *   const ups = await accessibleUpIds(session);
 *   const where = ups ? { unidadProductivaId: { in: ups } } : {};
 *
 * Vive aparte de `lib/rbac.ts` a propósito: importa Prisma y por eso no debe
 * entrar al bundle de cliente (rbac.ts sí se usa en componentes cliente).
 */
export async function accessibleUpIds(
  session: Session | null | undefined,
): Promise<number[] | null> {
  if (isAdmin(session)) return null;

  const usuarioId = userIdFromSession(session);
  if (usuarioId == null) return null;

  const asignaciones = await prisma.usuarioUnidadProductiva.findMany({
    where: { usuarioId },
    select: { unidadProductivaId: true },
  });
  if (asignaciones.length === 0) return null;
  return asignaciones.map((a) => a.unidadProductivaId);
}

/**
 * True si el usuario puede acceder a un registro de la UP dada. Los registros
 * sin UP (`upId == null`) nunca se ocultan — el scoping solo acota, no esconde
 * lo que no está clasificado.
 */
export async function canAccessUp(
  session: Session | null | undefined,
  upId: number | null | undefined,
): Promise<boolean> {
  const ids = await accessibleUpIds(session);
  if (ids === null) return true;
  if (upId == null) return true;
  return ids.includes(upId);
}
