"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  isAdmin,
  isPañolero,
  requireAuthenticated,
  userNameFromSession,
} from "@/lib/rbac";

import type { CerrarSinFacturaResult, RecepcionActionResult } from "./types";

const recepcionLineaSchema = z.object({
  ocDetalleId: z.coerce.number().int().positive(),
  cantidadRecibidaAhora: z.coerce.number().nonnegative(),
  destino: z.enum(["Stock", "Directa"]),
  observaciones: z.string().trim().max(500).optional().nullable(),
});

const recepcionSchema = z.object({
  ocId: z.coerce.number().int().positive(),
  numeroRemito: z.string().trim().min(1).max(64),
  fechaRecepcion: z.coerce.date(),
  recibidoPor: z.string().trim().min(1).max(120),
  observaciones: z.string().trim().max(500).optional().nullable(),
  lineas: z.array(recepcionLineaSchema).min(1),
});

export async function createRecepcion(
  raw: unknown,
): Promise<RecepcionActionResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isPañolero(session)) return { ok: false, error: "forbidden" };
  const creadoPor = userNameFromSession(session);

  const parsed = recepcionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  const activeLines = input.lineas.filter((l) => l.cantidadRecibidaAhora > 0);
  if (activeLines.length === 0)
    return { ok: false, error: "nothing_to_receive" };

  try {
    const recepcionId = await prisma.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({
        where: { id: input.ocId },
        select: {
          id: true,
          estado: true,
          detalle: {
            select: {
              id: true,
              cantidadSolicitada: true,
              cantidadRecibida: true,
              precioUnitario: true,
              requisicionDetalle: {
                select: {
                  itemId: true,
                  item: { select: { unidadMedida: true } },
                },
              },
            },
          },
        },
      });
      if (!oc) throw new Error("not_found");
      if (oc.estado !== "Emitida" && oc.estado !== "Parcialmente Recibida")
        throw new Error("wrong_estado");

      const byDetalle = new Map(oc.detalle.map((d) => [d.id, d]));
      for (const ln of activeLines) {
        const d = byDetalle.get(ln.ocDetalleId);
        if (!d)
          throw Object.assign(new Error("invalid"), { detail: "unknown_line" });
        const pendiente = d.cantidadSolicitada - d.cantidadRecibida;
        if (ln.cantidadRecibidaAhora > pendiente + 1e-9)
          throw new Error("over_reception");
      }

      const recepcion = await tx.recepcion.create({
        data: {
          ocId: input.ocId,
          numeroRemito: input.numeroRemito,
          fechaRecepcion: input.fechaRecepcion,
          recibidoPor: input.recibidoPor,
          observaciones: input.observaciones ?? null,
          creadoPor,
        },
        select: { id: true },
      });

      for (const ln of activeLines) {
        const d = byDetalle.get(ln.ocDetalleId)!;
        await tx.recepcionDetalle.create({
          data: {
            recepcionId: recepcion.id,
            ocDetalleId: ln.ocDetalleId,
            cantidadRecibida: ln.cantidadRecibidaAhora,
            facturado: false,
          },
        });
        await tx.ordenCompraDetalle.update({
          where: { id: ln.ocDetalleId },
          data: {
            cantidadRecibida: d.cantidadRecibida + ln.cantidadRecibidaAhora,
          },
        });
        if (ln.destino === "Stock") {
          await tx.inventarioMovimiento.create({
            data: {
              idItem: d.requisicionDetalle.itemId,
              tipo: "entrada",
              cantidad: ln.cantidadRecibidaAhora,
              unidadMedida: d.requisicionDetalle.item.unidadMedida ?? null,
              valorUnitario: d.precioUnitario,
              fecha: input.fechaRecepcion,
              usuario: input.recibidoPor,
              motivo: "Recepción compras",
              moduloOrigen: "compras",
              idOrigen: recepcion.id,
              observaciones: ln.observaciones ?? null,
              destino: "Stock",
            },
          });
          const item = await tx.inventario.findUnique({
            where: { id: d.requisicionDetalle.itemId },
            select: { stock: true, valorUnitario: true },
          });
          if (item) {
            const nuevoStock = item.stock + ln.cantidadRecibidaAhora;
            await tx.inventario.update({
              where: { id: d.requisicionDetalle.itemId },
              data: {
                stock: nuevoStock,
                valorTotal: nuevoStock * item.valorUnitario,
              },
            });
          }
        }
      }

      const fresh = await tx.ordenCompraDetalle.findMany({
        where: { ocId: input.ocId },
        select: { cantidadSolicitada: true, cantidadRecibida: true },
      });
      const allFull = fresh.every(
        (d) => d.cantidadRecibida >= d.cantidadSolicitada - 1e-9,
      );
      const anyReceived = fresh.some((d) => d.cantidadRecibida > 0);
      const nextEstado = allFull
        ? "Completada"
        : anyReceived
          ? "Parcialmente Recibida"
          : oc.estado;
      if (nextEstado !== oc.estado) {
        await tx.ordenCompra.update({
          where: { id: input.ocId },
          data: { estado: nextEstado },
        });
      }

      return recepcion.id;
    });

    revalidatePath("/compras/recepciones");
    revalidatePath(`/compras/recepciones/${recepcionId}`);
    revalidatePath("/compras/oc");
    revalidatePath(`/compras/oc/${input.ocId}`);
    return { ok: true, id: recepcionId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (
      msg === "not_found" ||
      msg === "wrong_estado" ||
      msg === "over_reception" ||
      msg === "invalid"
    )
      return { ok: false, error: msg };
    return { ok: false, error: "unknown" };
  }
}

const cerrarSinFacturaSchema = z.object({
  recepcionId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(1).max(500),
});

export async function cerrarRecepcionSinFactura(
  raw: unknown,
): Promise<CerrarSinFacturaResult> {
  const session = await auth();
  try {
    requireAuthenticated(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isAdmin(session)) return { ok: false, error: "forbidden" };
  const cerradoPor = userNameFromSession(session);

  const parsed = cerrarSinFacturaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { recepcionId, motivo } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const rec = await tx.recepcion.findUnique({
        where: { id: recepcionId },
        select: {
          id: true,
          cerradaSinFactura: true,
          detalle: { select: { facturado: true } },
        },
      });
      if (!rec) throw new Error("not_found");
      if (rec.cerradaSinFactura) throw new Error("already_closed");
      const pendientes = rec.detalle.filter((d) => !d.facturado).length;
      if (pendientes === 0) throw new Error("nothing_to_close");

      await tx.recepcion.update({
        where: { id: recepcionId },
        data: {
          cerradaSinFactura: true,
          motivoCierre: motivo,
          fechaCierre: new Date(),
          cerradoPor,
        },
      });
    });

    revalidatePath("/compras/recepciones");
    revalidatePath(`/compras/recepciones/${recepcionId}`);
    revalidatePath("/compras/facturas/nueva");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (
      msg === "not_found" ||
      msg === "already_closed" ||
      msg === "nothing_to_close" ||
      msg === "invalid"
    )
      return { ok: false, error: msg };
    return { ok: false, error: "unknown" };
  }
}
