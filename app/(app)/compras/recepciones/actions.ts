"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  requirePermission,
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
    requirePermission(session, "compras.recepcion.create");
  } catch {
    return { ok: false, error: "forbidden" };
  }
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

const cerrarSinFacturaLineaSchema = z.object({
  recepcionDetalleId: z.coerce.number().int().positive(),
  precioUnitario: z.coerce.number().nonnegative(),
});

const cerrarSinFacturaSchema = z.object({
  recepcionId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(1).max(500),
  // Optional per-line prices: lines listed here record the price paid
  // (RecepcionDetalle.precioUnitario + PrecioHistorico + weighted-avg cost),
  // just like a factura would. Lines omitted are closed without a price
  // (returns, free replacements, remitos with no cost).
  lineas: z.array(cerrarSinFacturaLineaSchema).default([]),
});

export async function cerrarRecepcionSinFactura(
  raw: unknown,
): Promise<CerrarSinFacturaResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.recepcion.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const usuario = userNameFromSession(session);

  const parsed = cerrarSinFacturaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { recepcionId, motivo, lineas } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const rec = await tx.recepcion.findUnique({
        where: { id: recepcionId },
        select: {
          id: true,
          cerradaSinFactura: true,
          fechaRecepcion: true,
          detalle: {
            select: {
              id: true,
              facturado: true,
              cantidadRecibida: true,
              ocDetalle: {
                select: {
                  oc: { select: { proveedorId: true } },
                  requisicionDetalle: {
                    select: {
                      item: {
                        select: {
                          id: true,
                          stock: true,
                          valorUnitario: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!rec) throw new Error("not_found");
      if (rec.cerradaSinFactura) throw new Error("already_closed");
      const pendientes = rec.detalle.filter((d) => !d.facturado);
      if (pendientes.length === 0) throw new Error("nothing_to_close");

      // Record the price paid for the lines the user priced. Same effect as a
      // factura line: persists the unit price, writes PrecioHistorico and
      // updates the item's weighted-average cost.
      const detalleById = new Map(rec.detalle.map((d) => [d.id, d]));
      for (const ln of lineas) {
        const d = detalleById.get(ln.recepcionDetalleId);
        if (!d || d.facturado) throw new Error("invalid");
        const item = d.ocDetalle.requisicionDetalle.item;
        const qty = d.cantidadRecibida;

        await tx.recepcionDetalle.update({
          where: { id: d.id },
          data: { precioUnitario: ln.precioUnitario },
        });
        await tx.precioHistorico.create({
          data: {
            itemId: item.id,
            proveedorId: d.ocDetalle.oc.proveedorId,
            fecha: rec.fechaRecepcion,
            precioArs: ln.precioUnitario,
            fuente: "cierre_sin_factura",
            usuario,
          },
        });
        const oldStock = item.stock - qty;
        const denom = oldStock + qty;
        if (denom > 0) {
          const newCost =
            (item.valorUnitario * oldStock + ln.precioUnitario * qty) / denom;
          await tx.inventario.update({
            where: { id: item.id },
            data: { valorUnitario: newCost, valorTotal: item.stock * newCost },
          });
        }
      }

      await tx.recepcion.update({
        where: { id: recepcionId },
        data: {
          cerradaSinFactura: true,
          motivoCierre: motivo,
          fechaCierre: new Date(),
          cerradoPor: usuario,
        },
      });
    });

    revalidatePath("/compras/recepciones");
    revalidatePath(`/compras/recepciones/${recepcionId}`);
    revalidatePath("/compras/facturas/nueva");
    revalidatePath("/listados/inventario");
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

const actualizarRecibidoPorSchema = z.object({
  recepcionId: z.coerce.number().int().positive(),
  recibidoPor: z.string().trim().min(1).max(120),
});

export async function actualizarRecibidoPor(
  raw: unknown,
): Promise<RecepcionActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.recepcion.update");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = actualizarRecibidoPorSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { recepcionId, recibidoPor } = parsed.data;

  try {
    const rec = await prisma.recepcion.findUnique({
      where: { id: recepcionId },
      select: { id: true },
    });
    if (!rec) return { ok: false, error: "not_found" };

    await prisma.recepcion.update({
      where: { id: recepcionId },
      data: { recibidoPor },
    });

    revalidatePath("/compras/recepciones");
    revalidatePath(`/compras/recepciones/${recepcionId}`);
    return { ok: true, id: recepcionId };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
