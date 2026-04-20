"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { CalendarEventTipo } from "./week-calendar";
import { TIPO_STYLES } from "./week-calendar";

export type CalendarLegendProps = {
  /** If omitted, show all tipos. */
  visibleTipos?: CalendarEventTipo[];
  className?: string;
};

const ALL_TIPOS: CalendarEventTipo[] = ["mant", "inv", "comp", "log", "ins"];

export function CalendarLegend({
  visibleTipos,
  className,
}: CalendarLegendProps) {
  const tTipos = useTranslations("calendar.tipos");
  const tipos = visibleTipos ?? ALL_TIPOS;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-0.5 py-1",
        className,
      )}
    >
      {tipos.map((tipo) => {
        const style = TIPO_STYLES[tipo];
        return (
          <span
            key={tipo}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
          >
            <span
              aria-hidden
              className={cn(
                "inline-block size-2.5 rounded-[3px] border-l-[3px]",
                style.bg,
                style.border,
              )}
            />
            <span>{tTipos(tipo)}</span>
          </span>
        );
      })}
    </div>
  );
}
