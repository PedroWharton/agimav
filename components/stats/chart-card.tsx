import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared chart-card shell. Matches the R8-04 estadísticas dashboard pattern:
 * - compact header (title + optional subtitle + optional link)
 * - flex-1 body for the chart / table
 * - optional footnote area via children composition
 *
 * Consumers wrap charts (Donut, HorizontalBars, StackedBars, Heatmap, PriceChart,
 * inline SVGs) and tables in this card. Keeps padding + typography consistent.
 */
export function ChartCard({
  title,
  subtitle,
  linkHref,
  linkLabel,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  linkHref?: string;
  linkLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex h-full flex-col gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="font-heading text-[13px] font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-[11.5px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {linkHref ? (
          <Link
            href={linkHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span>{linkLabel ?? "Ver más"}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}
