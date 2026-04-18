import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Shield,
  Ruler,
  Tag,
  MapPin,
  Users,
  Building2,
  Factory,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Entry = {
  href: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
};

const entries: Entry[] = [
  {
    href: "/listados/roles",
    icon: Shield,
    titleKey: "listados.roles.titulo",
    descriptionKey: "listados.roles.descripcion",
  },
  {
    href: "/listados/unidades-medida",
    icon: Ruler,
    titleKey: "listados.unidadesMedida.titulo",
    descriptionKey: "listados.unidadesMedida.descripcion",
  },
  {
    href: "/listados/tipos-unidad",
    icon: Tag,
    titleKey: "listados.tiposUnidad.titulo",
    descriptionKey: "listados.tiposUnidad.descripcion",
  },
  {
    href: "/listados/localidades",
    icon: MapPin,
    titleKey: "listados.localidades.titulo",
    descriptionKey: "listados.localidades.descripcion",
  },
  {
    href: "/listados/usuarios",
    icon: Users,
    titleKey: "listados.usuarios.titulo",
    descriptionKey: "listados.usuarios.descripcion",
  },
  {
    href: "/listados/proveedores",
    icon: Building2,
    titleKey: "listados.proveedores.titulo",
    descriptionKey: "listados.proveedores.descripcion",
  },
  {
    href: "/listados/unidades-productivas",
    icon: Factory,
    titleKey: "listados.unidadesProductivas.titulo",
    descriptionKey: "listados.unidadesProductivas.descripcion",
  },
];

export default async function ListadosIndexPage() {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.index.titulo")}
        description={t("listados.index.descripcion")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full p-5 gap-2 hover:bg-accent/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <CardTitle className="text-base">{t(entry.titleKey)}</CardTitle>
                    <CardDescription>{t(entry.descriptionKey)}</CardDescription>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
