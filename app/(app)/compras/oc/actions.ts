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
        cantidad: z.coerce.number().positive(),
        precioUnitario: z.coerce.number().min(0),
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

  // Dedupe: one entry per item (if the UI somehow submitted duplicates).
  type ItemConfig = {
    proveedorId: number;
    cantidad: number;
    precioUnitario: number;
  };
  const byItem = new Map<number, ItemConfig>();
  for (const a of parsed.data.asignaciones) {
    byItem.set(a.itemId, {
      proveedorId: a.proveedorId,
      cantidad: a.cantidad,
      precioUnitario: a.precioUnitario,
    });
  }
  if (byItem.size === 0) return { ok: false, error: "nothing_selected" };

  try {
    const ocIds = await prisma.$transaction(async (tx) => {
      // Fetch all pending requisicionDetalle for selected items, ordered by
      // requisicion creation date (oldest first) so we fill FIFO when a
      // partial OC quantity needs to be allocated across multiple solicitudes.
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
          prioridadItem: true,
          notasItem: true,
          requisicion: { select: { fechaCreacion: true } },
        },
        orderBy: [
          { requisicion: { fechaCreacion: "asc" } },
          { id: "asc" },
        ],
      });

      // Group by proveedor, keeping each item's detalles together and
      // remembering the user-chosen total cantidad and precio for the item.
      type DetalleSnapshot = {
        id: number;
        itemId: number;
        requisicionId: number;
        cantidad: number;
        cantidadAprobada: number | null;
        baseCantidad: number;
        prioridadItem: string;
        notasItem: string | null;
      };
      type LineGroup = {
        itemId: number;
        cantidad: number;
        precioUnitario: number;
        detalles: DetalleSnapshot[];
      };
      const byProveedor = new Map<number, Map<number, LineGroup>>();
      for (const d of detalles) {
        const cfg = byItem.get(d.itemId);
        if (cfg == null) continue;
        let perItem = byProveedor.get(cfg.proveedorId);
        if (!perItem) {
          perItem = new Map();
          byProveedor.set(cfg.proveedorId, perItem);
        }
        let group = perItem.get(d.itemId);
        if (!group) {
          group = {
            itemId: d.itemId,
            cantidad: cfg.cantidad,
            precioUnitario: cfg.precioUnitario,
            detalles: [],
          };
          perItem.set(d.itemId, group);
        }
        group.detalles.push({
          id: d.id,
          itemId: d.itemId,
          requisicionId: d.requisicionId,
          cantidad: d.cantidad,
          cantidadAprobada: d.cantidadAprobada,
          baseCantidad: d.cantidadAprobada ?? d.cantidad,
          prioridadItem: d.prioridadItem,
          notasItem: d.notasItem,
        });
      }

      // Every selected item must have produced at least one detalle row.
      const itemsWithAnyDetalle = new Set(detalles.map((d) => d.itemId));
      for (const itemId of byItem.keys()) {
        if (!itemsWithAnyDetalle.has(itemId)) {
          throw new Error("item_drained");
        }
      }

      const ocIds: number[] = [];
      for (const [proveedorId, perItem] of byProveedor) {
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

        let totalEstimado = 0;
        for (const group of perItem.values()) {
          // Greedy FIFO: walk detalles oldest-first and consume baseCantidad
          // until the user-chosen total is reached. The detalle that gets
          // partially consumed is split: existing row keeps the consumed
          // portion (linked to OC), and a new sibling detalle holds the
          // remainder as Pendiente so it shows up in pendientes again.
          const baseSum = group.detalles.reduce(
            (s, d) => s + d.baseCantidad,
            0,
          );
          if (group.cantidad > baseSum) throw new Error("cantidad_exceeds");

          let remaining = group.cantidad;
          for (const d of group.detalles) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, d.baseCantidad);
            remaining = Math.round((remaining - take) * 100) / 100;
            const isPartial = take < d.baseCantidad;

            if (isPartial) {
              const leftover = Math.round((d.baseCantidad - take) * 100) / 100;
              // Split the cantidad (originally requested) proportionally so
              // both rows preserve the cantidad >= cantidadAprobada invariant.
              const ratio = d.baseCantidad > 0 ? take / d.baseCantidad : 1;
              const consumedCantidad =
                Math.round(d.cantidad * ratio * 100) / 100;
              const remainderCantidad =
                Math.round((d.cantidad - consumedCantidad) * 100) / 100;

              await tx.requisicionDetalle.update({
                where: { id: d.id },
                data: {
                  cantidad: consumedCantidad,
                  cantidadAprobada: take,
                  estado: "Vinculada OC",
                  proveedorAsignadoId: proveedorId,
                },
              });
              await tx.requisicionDetalle.create({
                data: {
                  requisicionId: d.requisicionId,
                  itemId: d.itemId,
                  cantidad: remainderCantidad,
                  cantidadAprobada: leftover,
                  prioridadItem: d.prioridadItem,
                  notasItem: d.notasItem,
                  estado: "Pendiente",
                },
              });
            } else {
              await tx.requisicionDetalle.update({
                where: { id: d.id },
                data: {
                  estado: "Vinculada OC",
                  proveedorAsignadoId: proveedorId,
                },
              });
            }

            const lineTotal =
              Math.round(take * group.precioUnitario * 100) / 100;
            totalEstimado += lineTotal;
            await tx.ordenCompraDetalle.create({
              data: {
                ocId: oc.id,
                requisicionDetalleId: d.id,
                cantidadSolicitada: take,
                cantidadRecibida: 0,
                precioUnitario: group.precioUnitario,
                total: lineTotal,
              },
            });
          }
        }

        await tx.ordenCompra.update({
          where: { id: oc.id },
          data: { totalEstimado: Math.round(totalEstimado * 100) / 100 },
        });
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
    if (msg === "cantidad_exceeds")
      return { ok: false, error: "cantidad_exceeds" };
    return { ok: false, error: "unknown" };
  }
}
