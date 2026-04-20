import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CatalogTileProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  count: number;
  description?: string;
  meta?: string;
  highlight?: string;
  className?: string;
};

export function CatalogTile({
  href,
  icon: Icon,
  label,
  count,
  description,
  meta,
  highlight,
  className,
}: CatalogTileProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted-2 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <Icon className="size-[18px]" aria-hidden="true" strokeWidth={1.75} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-tight tracking-tight">
              {label}
            </span>
            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-subtle-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
          {description ? (
            <p className="text-[12.5px] leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-dashed border-border pt-2.5 text-[11.5px] text-muted-foreground">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          {count.toLocaleString("es-AR")}
        </span>
        {meta ? (
          <>
            <span className="text-border-strong">·</span>
            <span className="truncate">{meta}</span>
          </>
        ) : null}
        {highlight ? (
          <span className="ml-auto rounded-md bg-info-weak px-2 py-0.5 text-[11px] font-medium text-info">
            {highlight}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
