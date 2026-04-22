import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { userNameFromSession } from "@/lib/rbac";

import { RequisicionForm } from "../requisicion-form";

export default async function NuevaRequisicionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const currentUserName = userNameFromSession(session);

  const [inventario, unidades, localidades, usuarios] = await Promise.all([
    prisma.inventario.findMany({
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
      },
      orderBy: [{ codigo: "asc" }, { descripcion: "asc" }],
    }),
    prisma.unidadProductiva.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.localidad.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuario.findMany({
      where: { estado: "activo" },
      select: { nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <RequisicionForm
      mode="create"
      initial={null}
      inventarioOptions={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo ?? "",
        descripcion: i.descripcion ?? "",
        unidadMedida: i.unidadMedida,
      }))}
      unidadesProductivas={unidades.map((u) => u.nombre)}
      localidades={localidades.map((l) => l.nombre)}
      usuariosSolicitantes={usuarios.map((u) => u.nombre)}
      currentUserName={currentUserName}
      canMutate
      canApprove={false}
    />
  );
}
