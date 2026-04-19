"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  isAdmin,
  requireAuthenticated,
  userNameFromSession,
} from "@/lib/rbac";
import { formatOCNumber } from "@/lib/compras/oc-number";

import type { AsignarActionResult } from "./types";

const asignacionSchema = z.object({
  lineas: z
    .array(
      z.object({
        detalleId: z.coerce.number().int().positive(),
        proveedorId: z.coerce.number().int().positive().nullable(),
      }),
    )
    .min(1),
});

function canAsignar(estado: string): boolean {
  return estado === "Aprobada" || estado === "Asignado a Proveedor";
}

export async function saveAsignacion(
  requisicionId: number,
  raw: unknown,
): Promise<AsignarActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };

  const parsed = asignacionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const existing = await prisma.requisicion.findUnique({
    where: { id: requisicionId },
    select: {
      id: true,
      estado: true,
      detalle: { select: { id: true } },
    },
  });
  if (!existing) return { ok: false, error: "not_found" };
  if (!canAsignar(existing.estado))
    return { ok: false, error: "wrong_estado" };

  const known = new Set(existing.detalle.map((d) => d.id));
  for (const ln of parsed.data.lineas) {
    if (!known.has(ln.detalleId))
      return { ok: false, error: "invalid", message: "unknown_detalle" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const ln of parsed.data.lineas) {
        await tx.requisicionDetalle.update({
          where: { id: ln.detalleId },
          data: { proveedorAsignadoId: ln.proveedorId },
        });
      }

      const fresh = await tx.requisicionDetalle.findMany({
        where: { requisicionId },
        select: { id: true, proveedorAsignadoId: true },
      });
      const allAssigned =
        fresh.length > 0 && fresh.every((d) => d.proveedorAsignadoId != null);
      const nextEstado = allAssigned ? "Asignado a Proveedor" : "Aprobada";
      await tx.requisicion.update({
        where: { id: requisicionId },
        data: { estado: nextEstado },
      });
    });
    revalidatePath(`/compras/requisiciones/${requisicionId}`);
    revalidatePath(`/compras/requisiciones/${requisicionId}/asignar`);
    revalidatePath("/compras/requisiciones");
    return { ok: true, id: requisicionId };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function generarOCs(
  requisicionId: number,
): Promise<AsignarActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };
  const comprador = userNameFromSession(session);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.requisicion.findUnique({
        where: { id: requisicionId },
        select: {
          id: true,
          estado: true,
          detalle: {
            select: {
              id: true,
              cantidad: true,
              proveedorAsignadoId: true,
              estado: true,
              itemId: true,
            },
          },
        },
      });
      if (!req) throw new Error("not_found");
      if (req.estado !== "Asignado a Proveedor")
        throw new Error("wrong_estado");
      if (req.detalle.length === 0) throw new Error("incomplete");
      if (req.detalle.some((d) => d.proveedorAsignadoId == null))
        throw new Error("incomplete");

      const groups = new Map<
        number,
        Array<{ detalleId: number; itemId: number; cantidad: number }>
      >();
      for (const d of req.detalle) {
        const pid = d.proveedorAsignadoId as number;
        const arr = groups.get(pid) ?? [];
        arr.push({ detalleId: d.id, itemId: d.itemId, cantidad: d.cantidad });
        groups.set(pid, arr);
      }

      const ocIds: number[] = [];
      for (const [proveedorId, lines] of groups) {
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
        const numeroOc = formatOCNumber(oc.id);
        await tx.ordenCompra.update({
          where: { id: oc.id },
          data: { numeroOc },
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
            data: { estado: "Vinculada OC" },
          });
        }
        ocIds.push(oc.id);
      }

      await tx.requisicion.update({
        where: { id: requisicionId },
        data: { estado: "OC Emitida" },
      });

      return ocIds;
    });

    revalidatePath("/compras/requisiciones");
    revalidatePath(`/compras/requisiciones/${requisicionId}`);
    revalidatePath("/compras/oc");
    return { ok: true, id: requisicionId, ocIds: result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    if (
      message === "not_found" ||
      message === "wrong_estado" ||
      message === "incomplete"
    ) {
      return { ok: false, error: message };
    }
    return { ok: false, error: "unknown" };
  }
}
