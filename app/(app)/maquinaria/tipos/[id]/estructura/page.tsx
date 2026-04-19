import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import {
  StructureTree,
  type NivelView,
} from "@/components/app/structure-tree";

export default async function EstructuraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect("/maquinaria");
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const tipo = await prisma.maquinariaTipo.findUnique({
    where: { id },
    include: {
      niveles: {
        include: { atributos: true },
        orderBy: [{ orden: "asc" }, { id: "asc" }],
      },
      _count: { select: { maquinarias: true } },
    },
  });

  if (!tipo) notFound();

  const t = await getTranslations("maquinaria.estructura");

  const niveles: NivelView[] = tipo.niveles.map((n) => ({
    id: n.id,
    nombre: n.nombre,
    parentLevelId: n.parentLevelId,
    orden: n.orden,
    permiteInventario: n.permiteInventario,
    activo: n.activo,
    atributos: n.atributos.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      dataType: a.dataType,
      requerido: a.requerido,
      esPrincipal: a.esPrincipal,
      sourceRef: a.sourceRef,
      listOptions: a.listOptions,
      activo: a.activo,
    })),
  }));

  const totalAtributos = niveles.reduce((s, n) => s + n.atributos.length, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/maquinaria/tipos">
            <ArrowLeft className="size-4" />
            {t("volver")}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={t("titulo", { nombre: tipo.nombre })}
        description={t("subtitulo", {
          instancias: tipo._count.maquinarias,
          niveles: niveles.length,
          atributos: totalAtributos,
        })}
      />

      <StructureTree
        niveles={niveles}
        admin
        instanciasCount={tipo._count.maquinarias}
      />

      <p className="text-xs text-muted-foreground">{t("nivelesBloqueados")}</p>
    </div>
  );
}
