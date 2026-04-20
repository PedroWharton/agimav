import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CatalogTileProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  count: number;
  meta?: string;
  className?: string;
};

export function CatalogTile({
  href,
  icon: Icon,
  label,
  count,
  meta,
  className,
}: CatalogTileProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted-2 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="rounded-md bg-brand-weak p-2 text-brand">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <ChevronRight
          className="size-4 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-heading text-3xl font-semibold leading-none">
          {count.toLocaleString("es-AR")}
        </span>
        {meta ? (
          <span className="text-xs text-subtle-foreground">{meta}</span>
        ) : null}
      </div>
    </Link>
  );
}
