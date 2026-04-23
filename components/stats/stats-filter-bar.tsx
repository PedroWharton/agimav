import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";

/**
 * Read-only scope chip for the estadísticas dashboard. The interactive filter
 * bar (date range / comparar / obra / categoría / granularidad) is deferred
 * post-cutover (see docs/post-cutover-backlog.md). Until it lands, surface the
 * active window as a static chip so users understand what they're looking at.
 *
 * When wiring filters, replace this with a real control set.
 */
export async function StatsFilterBar({
  rangeLabel,
}: {
  rangeLabel: string;
}) {
  const t = await getTranslations("estadisticas.filtros");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-[13px] text-muted-foreground"
        aria-label={t("alcance")}
      >
        <CalendarDays
          className="size-3.5 text-subtle-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="font-medium text-foreground">{rangeLabel}</span>
      </span>
    </div>
  );
}
