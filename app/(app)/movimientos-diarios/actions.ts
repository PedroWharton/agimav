"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  requirePermission,
  userIdFromSession,
  userNameFromSession,
} from "@/lib/rbac";
import { canAccessUp } from "@/lib/up-scope";

import type { ActionResult } from "./types";

const MANAGE = "inventario.movimiento.create";

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const lineaSchema = z.object({
  itemInventarioId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().positive(),
  tipo: z.enum(["consumible", "herramienta"]),
  justificacion: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  observaciones: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const crearSchema = z.object({
  fecha: z.string().trim().min(1, "Ingresá una fecha"),
  usuario: optionalText(120),
  sector: optionalText(120),
  localidad: optionalText(120),
  unidadProductivaId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  observaciones: optionalText(1000),
  lineas: z.array(lineaSchema).min(1, "Agregá al menos una línea"),
});

export async function crearMovimientoDiario(
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = crearSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  // WS-B3: si el movimiento trae UP, tiene que ser una accesible.
  if (!(await canAccessUp(session, data.unidadProductivaId))) {
    return { ok: false, error: "forbidden" };
  }

  const usuarioMov = userNameFromSession(session) ?? "Sistema";
  const fecha = new Date(data.fecha);

  try {
    const registroId = await prisma.$transaction(async (tx) => {
      const registro = await tx.movimientoDiario.create({
        data: {
          fecha,
          usuario: data.usuario,
          sector: data.sector,
          localidad: data.localidad,
          unidadProductivaId: data.unidadProductivaId,
          observaciones: data.observaciones,
          createdById: userIdFromSession(session),
        },
      });

      for (const linea of data.lineas) {
        const item = await tx.inventario.findUnique({
          where: { id: linea.itemInventarioId },
          select: {
            id: true,
            codigo: true,
            descripcion: true,
            unidadMedida: true,
            valorUnitario: true,
            stock: true,
          },
        });
        if (!item) throw new Error("item_not_found");

        const monto = item.valorUnitario * linea.cantidad;

        await tx.movimientoDiarioLinea.create({
          data: {
            movimientoId: registro.id,
            itemInventarioId: item.id,
            codigoItem: item.codigo,
            descripcion: item.descripcion,
            cantidad: linea.cantidad,
            unidadMedida: item.unidadMedida,
            tipo: linea.tipo,
            monto,
            justificacion: linea.justificacion,
            observaciones: linea.observaciones,
          },
        });

        await tx.inventarioMovimiento.create({
          data: {
            idItem: item.id,
            tipo: "salida",
            cantidad: linea.cantidad,
            unidadMedida: item.unidadMedida,
            valorUnitario: item.valorUnitario,
            fecha,
            usuario: usuarioMov,
            motivo: linea.tipo === "herramienta" ? "Herramienta" : "Consumo",
            moduloOrigen: "movimiento_diario",
            idOrigen: registro.id,
            createdById: userIdFromSession(session),
          },
        });

        const nuevoStock = item.stock - linea.cantidad;
        await tx.inventario.update({
          where: { id: item.id },
          data: {
            stock: nuevoStock,
            valorTotal: nuevoStock * item.valorUnitario,
          },
        });
      }

      return registro.id;
    });

    revalidatePath("/movimientos-diarios");
    return { ok: true, id: registroId };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function devolverHerramienta(
  lineaId: number,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const linea = await prisma.movimientoDiarioLinea.findUnique({
    where: { id: lineaId },
    select: {
      id: true,
      tipo: true,
      devuelto: true,
      cantidad: true,
      unidadMedida: true,
      movimientoId: true,
      itemInventarioId: true,
      movimiento: { select: { unidadProductivaId: true } },
    },
  });
  if (!linea) return { ok: false, error: "not_found" };

  // WS-B3: no se puede mutar un movimiento de una UP fuera de scope.
  if (!(await canAccessUp(session, linea.movimiento.unidadProductivaId))) {
    return { ok: false, error: "forbidden" };
  }

  if (linea.tipo !== "herramienta" || linea.devuelto) {
    return { ok: false, error: "wrong_estado" };
  }

  const usuarioMov = userNameFromSession(session) ?? "Sistema";

  try {
    await prisma.$transaction(async (tx) => {
      if (linea.itemInventarioId != null) {
        const item = await tx.inventario.findUnique({
          where: { id: linea.itemInventarioId },
          select: { id: true, stock: true, valorUnitario: true },
        });
        if (item) {
          await tx.inventarioMovimiento.create({
            data: {
              idItem: item.id,
              tipo: "entrada",
              cantidad: linea.cantidad,
              unidadMedida: linea.unidadMedida,
              valorUnitario: item.valorUnitario,
              fecha: new Date(),
              usuario: usuarioMov,
              motivo: "Devolución de herramienta",
              moduloOrigen: "movimiento_diario",
              idOrigen: linea.movimientoId,
              createdById: userIdFromSession(session),
            },
          });
          const nuevoStock = item.stock + linea.cantidad;
          await tx.inventario.update({
            where: { id: item.id },
            data: {
              stock: nuevoStock,
              valorTotal: nuevoStock * item.valorUnitario,
            },
          });
        }
      }
      await tx.movimientoDiarioLinea.update({
        where: { id: linea.id },
        data: { devuelto: true, fechaDevolucion: new Date() },
      });
    });

    revalidatePath("/movimientos-diarios");
    revalidatePath(`/movimientos-diarios/${linea.movimientoId}`);
    return { ok: true, id: linea.movimientoId };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function eliminarMovimientoDiario(
  id: number,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const registro = await prisma.movimientoDiario.findUnique({
    where: { id },
    select: {
      id: true,
      unidadProductivaId: true,
      lineas: {
        select: {
          id: true,
          tipo: true,
          devuelto: true,
          cantidad: true,
          unidadMedida: true,
          itemInventarioId: true,
        },
      },
    },
  });
  if (!registro) return { ok: false, error: "not_found" };

  // WS-B3: no se puede eliminar un movimiento de una UP fuera de scope.
  if (!(await canAccessUp(session, registro.unidadProductivaId))) {
    return { ok: false, error: "forbidden" };
  }

  const usuarioMov = userNameFromSession(session) ?? "Sistema";

  try {
    await prisma.$transaction(async (tx) => {
      for (const linea of registro.lineas) {
        // El stock está "afuera" si es consumible, o herramienta sin devolver.
        const stockAfuera = !(linea.tipo === "herramienta" && linea.devuelto);
        if (!stockAfuera || linea.itemInventarioId == null) continue;

        const item = await tx.inventario.findUnique({
          where: { id: linea.itemInventarioId },
          select: { id: true, stock: true, valorUnitario: true },
        });
        if (!item) continue;

        await tx.inventarioMovimiento.create({
          data: {
            idItem: item.id,
            tipo: "entrada",
            cantidad: linea.cantidad,
            unidadMedida: linea.unidadMedida,
            valorUnitario: item.valorUnitario,
            fecha: new Date(),
            usuario: usuarioMov,
            motivo: "Reverso de movimiento diario eliminado",
            moduloOrigen: "movimiento_diario",
            idOrigen: registro.id,
            createdById: userIdFromSession(session),
          },
        });
        const nuevoStock = item.stock + linea.cantidad;
        await tx.inventario.update({
          where: { id: item.id },
          data: {
            stock: nuevoStock,
            valorTotal: nuevoStock * item.valorUnitario,
          },
        });
      }

      await tx.movimientoDiario.delete({ where: { id: registro.id } });
    });

    revalidatePath("/movimientos-diarios");
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
