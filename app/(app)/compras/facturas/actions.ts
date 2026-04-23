"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  requirePermission,
  userNameFromSession,
} from "@/lib/rbac";

import type { FacturaActionResult } from "./types";

const facturaLineaSchema = z.object({
  recepcionDetalleId: z.coerce.number().int().positive(),
  precioUnitario: z.coerce.number().nonnegative(),
  descuentoComercialPorcentaje: z.coerce.number().min(0).max(100).default(0),
});

const facturaSchema = z.object({
  proveedorId: z.coerce.number().int().positive(),
  numeroFactura: z.string().trim().min(1).max(64),
  fechaFactura: z.coerce.date(),
  subtotal: z.coerce.number().nonnegative(),
  descuentoComercial: z.coerce.number().nonnegative().default(0),
  descuentoFinanciero: z.coerce.number().nonnegative().default(0),
  recargo: z.coerce.number().nonnegative().default(0),
  netoGravado: z.coerce.number().nonnegative(),
  ivaPorcentaje: z.coerce.number().nonnegative().default(21),
  ivaMonto: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  lineas: z.array(facturaLineaSchema).min(1),
});

export async function createFactura(
  raw: unknown,
): Promise<FacturaActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "compras.factura.create");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const usuario = userNameFromSession(session);

  const parsed = facturaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  try {
    const facturaId = await prisma.$transaction(async (tx) => {
      const dup = await tx.factura.findUnique({
        where: { numeroFactura: input.numeroFactura },
        select: { id: true },
      });
      if (dup) throw new Error("duplicate_numero");

      const recepciones = await tx.recepcionDetalle.findMany({
        where: { id: { in: input.lineas.map((l) => l.recepcionDetalleId) } },
        include: {
          ocDetalle: {
            include: {
              oc: { select: { proveedorId: true } },
              requisicionDetalle: {
                include: {
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
      });
      if (recepciones.length !== input.lineas.length)
        throw new Error("not_found");

      for (const r of recepciones) {
        if (r.facturado) throw new Error("already_invoiced");
        if (r.ocDetalle.oc.proveedorId !== input.proveedorId)
          throw new Error("wrong_proveedor");
      }

      const byId = new Map(recepciones.map((r) => [r.id, r]));

      const factura = await tx.factura.create({
        data: {
          numeroFactura: input.numeroFactura,
          proveedorId: input.proveedorId,
          fechaFactura: input.fechaFactura,
          total: input.total,
          usuario,
          subtotal: input.subtotal,
          descuentoComercial: input.descuentoComercial,
          descuentoFinanciero: input.descuentoFinanciero,
          recargo: input.recargo,
          netoGravado: input.netoGravado,
          ivaPorcentaje: input.ivaPorcentaje,
          ivaMonto: input.ivaMonto,
        },
        select: { id: true },
      });

      for (const ln of input.lineas) {
        const r = byId.get(ln.recepcionDetalleId)!;
        const qty = r.cantidadRecibida;
        const netPrice =
          ln.precioUnitario *
          (1 - ln.descuentoComercialPorcentaje / 100);
        const lineTotal = netPrice * qty;
        const item = r.ocDetalle.requisicionDetalle.item;

        await tx.facturaDetalle.create({
          data: {
            facturaId: factura.id,
            recepcionDetalleId: ln.recepcionDetalleId,
            precioUnitario: ln.precioUnitario,
            total: lineTotal,
            descuentoComercialPorcentaje: ln.descuentoComercialPorcentaje,
          },
        });

        await tx.recepcionDetalle.update({
          where: { id: ln.recepcionDetalleId },
          data: { facturado: true },
        });

        await tx.precioHistorico.create({
          data: {
            itemId: item.id,
            proveedorId: input.proveedorId,
            fecha: input.fechaFactura,
            precioArs: netPrice,
            fuente: "factura",
            numeroDocumento: input.numeroFactura,
            usuario,
          },
        });

        const currentStock = item.stock;
        const oldStock = currentStock - qty;
        const denom = oldStock + qty;
        if (denom > 0) {
          const newCost =
            (item.valorUnitario * oldStock + netPrice * qty) / denom;
          await tx.inventario.update({
            where: { id: item.id },
            data: {
              valorUnitario: newCost,
              valorTotal: currentStock * newCost,
            },
          });
        }
      }

      return factura.id;
    });

    revalidatePath("/compras/facturas");
    revalidatePath(`/compras/facturas/${facturaId}`);
    revalidatePath("/compras/recepciones");
    revalidatePath("/listados/inventario");
    return { ok: true, id: facturaId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (
      msg === "duplicate_numero" ||
      msg === "not_found" ||
      msg === "already_invoiced" ||
      msg === "wrong_proveedor"
    )
      return { ok: false, error: msg };
    return { ok: false, error: "unknown" };
  }
}
