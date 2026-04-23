import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireViewOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";

export default async function MaquinariaIndexPage() {
  const session = await auth();
  requireViewOrRedirect(session, "maquinaria.view");

  const t = await getTranslations("maquinaria.index");

  const defaultTipo =
    (await prisma.maquinariaTipo.findFirst({
      where: { estado: "activo" },
      select: { id: true },
      orderBy: { nombre: "asc" },
    })) ??
    (await prisma.maquinariaTipo.findFirst({
      select: { id: true },
      orderBy: { nombre: "asc" },
    }));

  if (defaultTipo) redirect(`/maquinaria/${defaultTipo.id}`);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t("titulo")} description={t("descripcion")} />
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {t("sinTipos")}
      </div>
    </div>
  );
}
