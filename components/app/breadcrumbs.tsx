"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

import { NAV } from "@/lib/nav";

const listadosSubRoutes: Record<string, string> = {
  roles: "listados.roles.titulo",
  "unidades-medida": "listados.unidadesMedida.titulo",
  "tipos-unidad": "listados.tiposUnidad.titulo",
  localidades: "listados.localidades.titulo",
  usuarios: "listados.usuarios.titulo",
  proveedores: "listados.proveedores.titulo",
  "unidades-productivas": "listados.unidadesProductivas.titulo",
};

type Crumb = { href: string; label: string; isKey?: boolean };

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations();

  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;

  const section = NAV.find((s) =>
    s.items.some((i) => i.href === `/${segments[0]}`),
  );
  if (!section) return null;

  const top = section.items.find((i) => i.href === `/${segments[0]}`)!;

  const parts: Crumb[] = [
    { href: top.href, label: section.label },
    { href: top.href, label: t(top.labelKey) },
  ];

  if (segments[0] === "listados" && segments[1]) {
    const key = listadosSubRoutes[segments[1]];
    if (key) parts.push({ href: pathname, label: t(key) });
  }

  return (
    <nav className="flex items-center gap-2 text-[13px]">
      {parts.map((part, i) => {
        const last = i === parts.length - 1;
        const isSection = i === 0 && parts.length > 1;
        return (
          <div
            key={`${part.href}-${i}`}
            className="flex items-center gap-2"
          >
            {i > 0 ? (
              <ChevronRight
                className="size-3.5 text-subtle-foreground/60"
                aria-hidden="true"
              />
            ) : null}
            {last ? (
              <span className="text-foreground font-medium">{part.label}</span>
            ) : isSection ? (
              <span className="text-subtle-foreground">{part.label}</span>
            ) : (
              <Link
                href={part.href}
                className="text-subtle-foreground hover:text-foreground transition-colors"
              >
                {part.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
