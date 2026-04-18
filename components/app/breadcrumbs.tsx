"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

import { navItems } from "@/lib/nav";

const listadosSubRoutes: Record<string, string> = {
  roles: "listados.roles.titulo",
  "unidades-medida": "listados.unidadesMedida.titulo",
  "tipos-unidad": "listados.tiposUnidad.titulo",
  localidades: "listados.localidades.titulo",
  usuarios: "listados.usuarios.titulo",
  proveedores: "listados.proveedores.titulo",
  "unidades-productivas": "listados.unidadesProductivas.titulo",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations();

  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;

  const top = navItems.find((item) => item.href === `/${segments[0]}`);
  if (!top) return null;

  const parts: { href: string; labelKey: string }[] = [
    { href: top.href, labelKey: top.labelKey },
  ];

  if (segments[0] === "listados" && segments[1]) {
    const key = listadosSubRoutes[segments[1]];
    if (key) parts.push({ href: pathname, labelKey: key });
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {parts.map((part, i) => {
        const last = i === parts.length - 1;
        return (
          <div key={part.href} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" /> : null}
            {last ? (
              <span className="font-medium">{t(part.labelKey)}</span>
            ) : (
              <Link
                href={part.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t(part.labelKey)}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
