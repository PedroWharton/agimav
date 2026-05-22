import { getTranslations } from "next-intl/server";
import {
  Shield,
  Ruler,
  Tag,
  Users,
  Building2,
  Factory,
  Wrench,
  Info,
  type LucideIcon,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireViewOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { CatalogTile } from "@/components/listados/catalog-tile";

type TileEntry = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
  count: number;
  meta?: string;
  highlight?: string;
};

type Section = {
  id: string;
  labelKey: string;
  tiles: TileEntry[];
};

function joinSample(items: string[], maxItems = 3, ellipsis = "…"): string {
  const shown = items.slice(0, maxItems);
  return items.length > maxItems ? `${shown.join(", ")}${ellipsis}` : shown.join(", ");
}

export default async function ListadosIndexPage() {
  const session = await auth();
  requireViewOrRedirect(session, "listados.view");

  const t = await getTranslations();

  const [
    usuariosTotal,
    usuariosActivos,
    roleNames,
    proveedoresTotal,
    proveedoresActivos,
    proveedoresServicioTotal,
    proveedoresServicioActivos,
    unidadesProductivasTotal,
    unidadesProductivasSample,
    tiposUnidadTotal,
    tipoUnidadNames,
    unidadesMedidaTotal,
    unidadesMedidaSample,
  ] = await Promise.all([
    prisma.usuario.count(),
    prisma.usuario.count({ where: { estado: "activo" } }),
    prisma.rol.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
      take: 6,
    }),
    prisma.proveedor.count(),
    prisma.proveedor.count({ where: { estado: "activo" } }),
    prisma.proveedorServicio.count(),
    prisma.proveedorServicio.count({ where: { estado: "activo" } }),
    prisma.unidadProductiva.count(),
    prisma.unidadProductiva.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
      take: 3,
    }),
    prisma.tipoUnidad.count(),
    prisma.tipoUnidad.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
      take: 5,
    }),
    prisma.unidadMedida.count(),
    prisma.unidadMedida.findMany({
      select: { abreviacion: true },
      orderBy: { nombre: "asc" },
      take: 6,
    }),
  ]);

  const usuariosInactivos = usuariosTotal - usuariosActivos;
  const proveedoresInactivos = proveedoresTotal - proveedoresActivos;
  const proveedoresServicioInactivos =
    proveedoresServicioTotal - proveedoresServicioActivos;

  const roleSample = roleNames.slice(0, 5).map((r) => r.nombre).join(", ");
  const upMeta = joinSample(unidadesProductivasSample.map((u) => u.nombre));
  const tipoUnidadMeta = tipoUnidadNames.map((t) => t.nombre).join(" · ");
  const unidadesMedidaMeta = unidadesMedidaSample
    .map((u) => u.abreviacion)
    .join(" · ") + (unidadesMedidaTotal > 6 ? " …" : "");

  const sections: Section[] = [
    {
      id: "organizacion",
      labelKey: "listados.tiles.grupos.organizacion",
      tiles: [
        {
          href: "/listados/usuarios",
          icon: Users,
          labelKey: "listados.usuarios.titulo",
          descriptionKey: "listados.tiles.descripciones.usuarios",
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
          descriptionKey: "listados.tiles.descripciones.roles",
          count: roleNames.length,
          meta: roleSample,
        },
        {
          href: "/listados/proveedores",
          icon: Building2,
          labelKey: "listados.proveedores.titulo",
          descriptionKey: "listados.tiles.descripciones.proveedores",
          count: proveedoresTotal,
          meta: t("listados.tiles.meta.activosInactivos", {
            activos: proveedoresActivos,
            inactivos: proveedoresInactivos,
          }),
          highlight: t("listados.index.vistaCompleta"),
        },
        {
          href: "/listados/proveedores-servicio",
          icon: Wrench,
          labelKey: "listados.proveedoresServicio.titulo",
          descriptionKey: "listados.tiles.descripciones.proveedoresServicio",
          count: proveedoresServicioTotal,
          meta: t("listados.tiles.meta.activosInactivos", {
            activos: proveedoresServicioActivos,
            inactivos: proveedoresServicioInactivos,
          }),
        },
      ],
    },
    {
      id: "estructura",
      labelKey: "listados.tiles.grupos.estructura",
      tiles: [
        {
          href: "/listados/unidades-productivas",
          icon: Factory,
          labelKey: "listados.unidadesProductivas.titulo",
          descriptionKey: "listados.tiles.descripciones.unidadesProductivas",
          count: unidadesProductivasTotal,
          meta: upMeta,
        },
        {
          href: "/listados/tipos-unidad",
          icon: Tag,
          labelKey: "listados.tiposUnidad.titulo",
          descriptionKey: "listados.tiles.descripciones.tiposUnidad",
          count: tiposUnidadTotal,
          meta: tipoUnidadMeta,
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
          descriptionKey: "listados.tiles.descripciones.unidadesMedida",
          count: unidadesMedidaTotal,
          meta: unidadesMedidaMeta,
        },
      ],
    },
  ];

  const auditHintHtml = t.raw("listados.index.auditHint") as string;

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title={t("listados.index.titulo")}
        description={t("listados.index.descripcion")}
      />

      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-info/25 bg-info-weak px-3.5 py-3 text-[12.5px] leading-snug text-info"
      >
        <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
        <p
          className="[&>strong]:font-semibold [&>strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: auditHintHtml }}
        />
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} className="space-y-3">
            <h2 className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle-foreground after:h-px after:flex-1 after:bg-border after:content-['']">
              {t(section.labelKey)}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {section.tiles.map((tile) => (
                <CatalogTile
                  key={tile.href}
                  href={tile.href}
                  icon={tile.icon}
                  label={t(tile.labelKey)}
                  description={t(tile.descriptionKey)}
                  count={tile.count}
                  meta={tile.meta}
                  highlight={tile.highlight}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
