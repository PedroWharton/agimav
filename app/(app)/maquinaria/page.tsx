import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Settings2, Truck } from "lucide-react";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";

export default async function MaquinariaIndexPage() {
  const session = await auth();
  const admin = isAdmin(session);
  const t = await getTranslations("maquinaria.index");

  const tipos = await prisma.maquinariaTipo.findMany({
    select: {
      id: true,
      nombre: true,
      estado: true,
      unidadMedicion: true,
      abrevUnidad: true,
      _count: { select: { maquinarias: true } },
    },
    orderBy: [{ estado: "asc" }, { nombre: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("titulo")}
        description={t("descripcion")}
        actions={
          admin ? (
            <Button asChild variant="outline">
              <Link href="/maquinaria/tipos">
                <Settings2 className="size-4" />
                {t("administrarTipos")}
              </Link>
            </Button>
          ) : null
        }
      />

      {tipos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("sinTipos")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tipos.map((tipo) => (
            <Link key={tipo.id} href={`/maquinaria/${tipo.id}`}>
              <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:bg-muted/40">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Truck className="size-5" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="text-base">{tipo.nombre}</CardTitle>
                    <CardDescription>
                      {t("instancias", { count: tipo._count.maquinarias })}
                      {tipo.unidadMedicion ? (
                        <span>
                          {" · "}
                          {tipo.unidadMedicion}
                          {tipo.abrevUnidad ? ` (${tipo.abrevUnidad})` : null}
                        </span>
                      ) : null}
                    </CardDescription>
                  </div>
                  {tipo.estado === "inactivo" ? (
                    <Badge variant="secondary" className="ml-auto">
                      {t("inactivo")}
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
