"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userNameFromSession } from "@/lib/rbac";

export type ResolverPrecioResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid" | "not_found" | "unknown" };

const resolverSchema = z.object({
  insumoId: z.coerce.number().int().positive(),
  costoUnitario: z.coerce.number().nonnegative(),
});

/**
 * Manually resolves the pending price of a mantenimiento insumo (WS-A4). The
 * automatic path is the factura propagation in createFactura (WS-A3); this is
 * the manual fallback surfaced by the "precios pendientes" screen.
 */
export async function resolverPrecioInsumo(
  raw: unknown,
): Promise<ResolverPrecioResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.factura.create");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const usuario = userNameFromSession(session);

  const parsed = resolverSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { insumoId, costoUnitario } = parsed.data;

  try {
    const insumo = await prisma.mantenimientoInsumo.findUnique({
      where: { id: insumoId },
      select: {
        id: true,
        mantenimientoId: true,
        cantidadUtilizada: true,
        precioPendiente: true,
      },
    });
    if (!insumo) return { ok: false, error: "not_found" };
    if (!insumo.precioPendiente) return { ok: false, error: "invalid" };

    await prisma.$transaction(async (tx) => {
      await tx.mantenimientoInsumo.update({
        where: { id: insumoId },
        data: {
          costoUnitario,
          costoTotal: insumo.cantidadUtilizada * costoUnitario,
          precioPendiente: false,
        },
      });
      await tx.mantenimientoHistorial.create({
        data: {
          mantenimientoId: insumo.mantenimientoId,
          tipoCambio: "insumo",
          valorAnterior: null,
          valorNuevo: null,
          detalle: "Precio de insumo resuelto manualmente",
          usuario: usuario ?? "—",
        },
      });
    });

    revalidatePath("/compras/precios-pendientes");
    revalidatePath(`/mantenimiento/${insumo.mantenimientoId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
