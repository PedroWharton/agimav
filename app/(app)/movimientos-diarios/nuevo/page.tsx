import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  hasPermission,
  requireViewOrRedirect,
  userNameFromSession,
} from "@/lib/rbac";
import { getLocalidadesSugeridas } from "@/lib/localidades";

import { MovimientoForm } from "../movimiento-form";

export const dynamic = "force-dynamic";

export default async function NuevoMovimientoDiarioPage() {
  const session = await auth();
  requireViewOrRedirect(session, "inventario.view");
  if (!hasPermission(session, "inventario.movimiento.create")) {
    redirect("/movimientos-diarios");
  }

  const [inventario, localidades] = await Promise.all([
    prisma.inventario.findMany({
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
        stock: true,
        valorUnitario: true,
      },
      orderBy: { descripcion: "asc" },
    }),
    getLocalidadesSugeridas(),
  ]);

  return (
    <MovimientoForm
      inventario={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
        stock: i.stock,
        valorUnitario: i.valorUnitario,
      }))}
      localidades={localidades}
      usuarioActual={userNameFromSession(session) ?? ""}
    />
  );
}
