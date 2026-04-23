import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasPermission, requireViewOrRedirect } from "@/lib/rbac";
import { prisma } from "@/lib/db";

import { PlantillaForm } from "../plantilla-form";

export default async function NuevaPlantillaPage() {
  const session = await auth();
  requireViewOrRedirect(session, "mantenimiento.view");
  if (!hasPermission(session, "mantenimiento.plantillas.manage")) {
    redirect("/mantenimiento/plantillas");
  }

  const [tipos, inventario] = await Promise.all([
    prisma.maquinariaTipo.findMany({
      where: { estado: "activo" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.inventario.findMany({
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
      },
      orderBy: { descripcion: "asc" },
    }),
  ]);

  return (
    <PlantillaForm
      mode="new"
      initial={{
        nombre: "",
        tipoMaquinariaId: null,
        frecuenciaValor: "",
        frecuenciaUnidad: "horas",
        prioridad: "Media",
        descripcion: "",
        insumos: [],
        tareas: [],
      }}
      tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre }))}
      inventario={inventario.map((i) => ({
        id: i.id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
      }))}
      canManage={true}
    />
  );
}
