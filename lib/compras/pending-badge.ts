import { prisma } from "@/lib/db";

/**
 * Count of OrdenCompra rows in estado "Emitida" that have no Recepcion linked
 * yet. Used to power the compras sidebar badge.
 */
export async function comprasPendientesRecepcion(): Promise<number> {
  return prisma.ordenCompra.count({
    where: {
      estado: "Emitida",
      recepciones: { none: {} },
    },
  });
}
