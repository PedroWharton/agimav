"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";

export type SidebarBadges = Partial<Record<string, number>>;

export function Sidebar({ badges }: { badges?: SidebarBadges }) {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="text-base font-semibold tracking-tight">
          {t("app.nombre")}
        </div>
        <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const badgeCount = badges?.[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {badgeCount && badgeCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-xs font-medium text-destructive tabular-nums">
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
