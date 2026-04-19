import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  href,
  children,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon?: LucideIcon;
  href?: string;
  children?: React.ReactNode;
  tone?: "default" | "warn";
  className?: string;
}) {
  const body = (
    <Card
      className={cn(
        "flex h-full flex-col gap-3 p-5",
        href &&
          "transition-colors hover:bg-muted/40 hover:ring-foreground/20",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              "rounded-md p-2",
              tone === "warn"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span
            className={cn(
              "font-heading text-3xl font-semibold leading-none",
              tone === "warn"
                ? "text-amber-700 dark:text-amber-400"
                : "text-foreground",
            )}
          >
            {value}
          </span>
          {caption ? (
            <span className="mt-1 text-xs text-muted-foreground">
              {caption}
            </span>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-auto">{children}</div> : null}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
