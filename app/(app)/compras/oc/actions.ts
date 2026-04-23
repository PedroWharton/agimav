"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  requirePermission,
  userNameFromSession,
} from "@/lib/rbac";
import { formatOCNumber } from "@/lib/compras/oc-number";

import type { EmitirOcsResult, OcActionResult } from "./types";

export async function cancelarOC(id: number): Promise<OcActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.oc.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }
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
    revalidatePath("/compras/solicitudes");
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "not_found" || msg === "wrong_estado" || msg === "has_recepciones")
      return { ok: false, error: msg };
    return { ok: false, error: "unknown" };
  }
}

const emitirSchema = z.object({
  asignaciones: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        proveedorId: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

export async function emitirOcsAgrupadas(
  raw: unknown,
): Promise<EmitirOcsResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.oc.create");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const comprador = userNameFromSession(session);

  const parsed = emitirSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  // Dedupe: one proveedor per item (if the UI somehow submitted duplicates).
  const byItem = new Map<number, number>();
  for (const a of parsed.data.asignaciones) byItem.set(a.itemId, a.proveedorId);
  if (byItem.size === 0) return { ok: false, error: "nothing_selected" };

  try {
    const ocIds = await prisma.$transaction(async (tx) => {
      // Fetch all pending requisicionDetalle for selected items.
      const detalles = await tx.requisicionDetalle.findMany({
        where: {
          itemId: { in: Array.from(byItem.keys()) },
          estado: "Pendiente",
          requisicion: {
            estado: { in: ["Aprobada", "Asignado a Proveedor"] },
          },
        },
        select: {
          id: true,
          itemId: true,
          cantidad: true,
          cantidadAprobada: true,
          requisicionId: true,
        },
      });

      // Group by proveedor → list of detalles that feed each OC.
      const byProveedor = new Map<
        number,
        Array<{ detalleId: number; cantidad: number }>
      >();
      for (const d of detalles) {
        const pid = byItem.get(d.itemId);
        if (pid == null) continue;
        const arr = byProveedor.get(pid) ?? [];
        arr.push({
          detalleId: d.id,
          cantidad: d.cantidadAprobada ?? d.cantidad,
        });
        byProveedor.set(pid, arr);
      }

      // Every selected item must have produced at least one detalle row.
      const itemsWithAnyDetalle = new Set(detalles.map((d) => d.itemId));
      for (const itemId of byItem.keys()) {
        if (!itemsWithAnyDetalle.has(itemId)) {
          throw new Error("item_drained");
        }
      }

      const ocIds: number[] = [];
      for (const [proveedorId, lines] of byProveedor) {
        const oc = await tx.ordenCompra.create({
          data: {
            proveedorId,
            estado: "Emitida",
            comprador,
            creadoPor: comprador,
            totalEstimado: 0,
          },
          select: { id: true },
        });
        await tx.ordenCompra.update({
          where: { id: oc.id },
          data: { numeroOc: formatOCNumber(oc.id) },
        });
        for (const ln of lines) {
          await tx.ordenCompraDetalle.create({
            data: {
              ocId: oc.id,
              requisicionDetalleId: ln.detalleId,
              cantidadSolicitada: ln.cantidad,
              cantidadRecibida: 0,
              precioUnitario: 0,
              total: 0,
            },
          });
          await tx.requisicionDetalle.update({
            where: { id: ln.detalleId },
            data: {
              estado: "Vinculada OC",
              proveedorAsignadoId: proveedorId,
            },
          });
        }
        ocIds.push(oc.id);
      }

      // Recompute parent requisicion estados for every touched requisicion.
      const reqIds = Array.from(new Set(detalles.map((d) => d.requisicionId)));
      for (const requisicionId of reqIds) {
        const siblings = await tx.requisicionDetalle.findMany({
          where: { requisicionId },
          select: { estado: true },
        });
        if (siblings.length === 0) continue;
        const allLinked = siblings.every((s) => s.estado === "Vinculada OC");
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

      return ocIds;
    });

    revalidatePath("/compras/oc");
    revalidatePath("/compras/solicitudes");
    return { ok: true, ocIds };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "item_drained") return { ok: false, error: "item_drained" };
    return { ok: false, error: "unknown" };
  }
}
