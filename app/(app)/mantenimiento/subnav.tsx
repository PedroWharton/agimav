"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  key: "mantenimientos" | "plantillas" | "horometros";
  exact?: boolean;
};

const TABS: Tab[] = [
  { href: "/mantenimiento", key: "mantenimientos", exact: true },
  { href: "/mantenimiento/plantillas", key: "plantillas" },
  { href: "/mantenimiento/horometros", key: "horometros" },
];

export function MantenimientoSubnav() {
  const pathname = usePathname();
  const t = useTranslations("mantenimiento.subnav");

  return (
    <nav className="border-b border-border bg-background/60 px-6">
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href ||
              (pathname.startsWith(`${tab.href}/`) &&
                !pathname.startsWith("/mantenimiento/plantillas") &&
                !pathname.startsWith("/mantenimiento/horometros"))
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
