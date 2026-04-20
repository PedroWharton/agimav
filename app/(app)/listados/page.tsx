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
import { CatalogTile } from "@/components/listados/catalog-tile";
import { prisma } from "@/lib/db";

type TileEntry = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  count: number;
  meta?: string;
};

type Section = {
  id: string;
  labelKey: string;
  tiles: TileEntry[];
};

export default async function ListadosIndexPage() {
  const t = await getTranslations();

  const [
    usuariosTotal,
    usuariosActivos,
    rolesTotal,
    proveedoresTotal,
    proveedoresActivos,
    localidadesTotal,
    unidadesProductivasTotal,
    tiposUnidadTotal,
    unidadesMedidaTotal,
  ] = await Promise.all([
    prisma.usuario.count(),
    prisma.usuario.count({ where: { estado: "activo" } }),
    prisma.rol.count(),
    prisma.proveedor.count(),
    prisma.proveedor.count({ where: { estado: "activo" } }),
    prisma.localidad.count(),
    prisma.unidadProductiva.count(),
    prisma.tipoUnidad.count(),
    prisma.unidadMedida.count(),
  ]);

  const usuariosInactivos = usuariosTotal - usuariosActivos;
  const proveedoresInactivos = proveedoresTotal - proveedoresActivos;

  const sections: Section[] = [
    {
      id: "organizacion",
      labelKey: "listados.tiles.grupos.organizacion",
      tiles: [
        {
          href: "/listados/usuarios",
          icon: Users,
          labelKey: "listados.usuarios.titulo",
          count: usuariosTotal,
          meta: t("listados.tiles.meta.activosInactivos", {
            activos: usuariosActivos,
            inactivos: usuariosInactivos,
          }),
        },
        {
          href: "/listados/roles",
          icon: Shield,
          labelKey: "listados.roles.titulo",
          count: rolesTotal,
        },
        {
          href: "/listados/proveedores",
          icon: Building2,
          labelKey: "listados.proveedores.titulo",
          count: proveedoresTotal,
          meta: t("listados.tiles.meta.activosInactivos", {
            activos: proveedoresActivos,
            inactivos: proveedoresInactivos,
          }),
        },
      ],
    },
    {
      id: "estructura",
      labelKey: "listados.tiles.grupos.estructura",
      tiles: [
        {
          href: "/listados/localidades",
          icon: MapPin,
          labelKey: "listados.localidades.titulo",
          count: localidadesTotal,
        },
        {
          href: "/listados/unidades-productivas",
          icon: Factory,
          labelKey: "listados.unidadesProductivas.titulo",
          count: unidadesProductivasTotal,
        },
        {
          href: "/listados/tipos-unidad",
          icon: Tag,
          labelKey: "listados.tiposUnidad.titulo",
          count: tiposUnidadTotal,
        },
      ],
    },
    {
      id: "unidades",
      labelKey: "listados.tiles.grupos.unidades",
      tiles: [
        {
          href: "/listados/unidades-medida",
          icon: Ruler,
          labelKey: "listados.unidadesMedida.titulo",
          count: unidadesMedidaTotal,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("listados.index.titulo")}
        description={t("listados.index.descripcion")}
      />

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-subtle-foreground">
              {t(section.labelKey)}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {section.tiles.map((tile) => (
                <CatalogTile
                  key={tile.href}
                  href={tile.href}
                  icon={tile.icon}
                  label={t(tile.labelKey)}
                  count={tile.count}
                  meta={tile.meta}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
