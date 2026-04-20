"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { NAV } from "@/lib/nav";

export type SidebarBadges = Partial<Record<string, number>>;

export function SidebarNav({ badges }: { badges?: SidebarBadges }) {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-3">
      {NAV.map((section) => (
        <div key={section.id}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-subtle-foreground px-3 mt-4 mb-1">
            {section.label}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const badgeCount = badges?.[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-weak text-foreground font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r before:bg-brand"
                      : "text-subtle-foreground hover:bg-muted-2 hover:text-foreground",
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
          </div>
        </div>
      ))}
    </nav>
  );
}
