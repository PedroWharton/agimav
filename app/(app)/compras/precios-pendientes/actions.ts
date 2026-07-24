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

/**
 * Manually resolves the pending price of an OT insumo. Mirrors
 * resolverPrecioInsumo: same permission, same cost rule as saveOtInsumos
 * (costoTotal = precioPendiente ? 0 : cantidad * costoUnitario — resolving
 * clears the flag, so costoTotal = cantidad * costoUnitario). Like the
 * mantenimiento resolver, it does not filter by the parent's estado: fixing a
 * cost left at 0 on a closed OT is a data correction, not an OT edit.
 */
export async function resolverPrecioOtInsumo(
  raw: unknown,
): Promise<ResolverPrecioResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.factura.create");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = resolverSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { insumoId, costoUnitario } = parsed.data;

  try {
    const insumo = await prisma.otInsumo.findUnique({
      where: { id: insumoId },
      select: {
        id: true,
        otId: true,
        cantidad: true,
        precioPendiente: true,
      },
    });
    if (!insumo) return { ok: false, error: "not_found" };
    if (!insumo.precioPendiente) return { ok: false, error: "invalid" };

    await prisma.otInsumo.update({
      where: { id: insumoId },
      data: {
        costoUnitario,
        costoTotal: insumo.cantidad * costoUnitario,
        precioPendiente: false,
      },
    });

    revalidatePath("/compras/precios-pendientes");
    revalidatePath("/ordenes-trabajo");
    revalidatePath(`/ordenes-trabajo/${insumo.otId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
