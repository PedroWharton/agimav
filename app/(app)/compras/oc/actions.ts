"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  isAdmin,
  requireAuthenticated,
  userNameFromSession,
} from "@/lib/rbac";

export type OcActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "not_found"
        | "wrong_estado"
        | "has_recepciones"
        | "unknown";
    };

export async function cancelarOC(id: number): Promise<OcActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };
  const canceladoPor = userNameFromSession(session);

  try {
    await prisma.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({
        where: { id },
        select: {
          id: true,
          estado: true,
          detalle: { select: { id: true, requisicionDetalleId: true } },
          _count: { select: { recepciones: true } },
        },
      });
      if (!oc) throw new Error("not_found");
      if (oc.estado !== "Emitida") throw new Error("wrong_estado");
      if (oc._count.recepciones > 0) throw new Error("has_recepciones");

      for (const d of oc.detalle) {
        await tx.requisicionDetalle.update({
          where: { id: d.requisicionDetalleId },
          data: { estado: "Pendiente", proveedorAsignadoId: null },
        });
      }

      await tx.ordenCompra.update({
        where: { id },
        data: {
          estado: "Cancelada",
          fechaCancelacion: new Date(),
          canceladoPor,
        },
      });

      const reqIds = Array.from(
        new Set(
          (
            await tx.requisicionDetalle.findMany({
              where: { id: { in: oc.detalle.map((d) => d.requisicionDetalleId) } },
              select: { requisicionId: true },
            })
          ).map((r) => r.requisicionId),
        ),
      );
      for (const requisicionId of reqIds) {
        const siblings = await tx.requisicionDetalle.findMany({
          where: { requisicionId },
          select: { estado: true },
        });
        const allLinked =
          siblings.length > 0 &&
          siblings.every((s) => s.estado === "Vinculada OC");
        const anyLinked = siblings.some((s) => s.estado === "Vinculada OC");
        const nextEstado = allLinked
          ? "OC Emitida"
          : anyLinked
            ? "Asignado a Proveedor"
            : "Aprobada";
        await tx.requisicion.update({
          where: { id: requisicionId },
          data: { estado: nextEstado },
        });
      }
    });
    revalidatePath("/compras/oc");
    revalidatePath(`/compras/oc/${id}`);
    revalidatePath("/compras/requisiciones");
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "not_found" || msg === "wrong_estado" || msg === "has_recepciones")
      return { ok: false, error: msg };
    return { ok: false, error: "unknown" };
  }
}
