import { getTranslations } from "next-intl/server";
import { CalendarDays, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatsGranularity = "dia" | "semana" | "mes";

type FilterButtonProps = {
  label: string;
  value: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  title?: string;
};

function FilterButton({
  label,
  value,
  icon,
  trailingIcon,
  title,
}: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-disabled="true"
      title={title}
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {icon}
      {label ? (
        <span className="text-subtle-foreground">{label}:</span>
      ) : null}
      <span className="font-medium">{value}</span>
      {trailingIcon}
    </button>
  );
}

export async function StatsFilterBar({
  rangeLabel,
  granularity = "mes",
}: {
  rangeLabel: string;
  granularity?: StatsGranularity;
}) {
  const t = await getTranslations("estadisticas.filtros");
  const proximamente = t("proximamente");

  const segments: { key: StatsGranularity; label: string }[] = [
    { key: "dia", label: t("granularidad.dia") },
    { key: "semana", label: t("granularidad.semana") },
    { key: "mes", label: t("granularidad.mes") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range pill */}
      <button
        type="button"
        aria-disabled="true"
        title={proximamente}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <CalendarDays
          className="size-3.5 text-subtle-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="font-medium">{rangeLabel}</span>
      </button>

      <FilterButton
        label={t("compararCon")}
        value={t("compararValor")}
        trailingIcon={
          <ChevronDown
            className="size-3.5 text-subtle-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
        }
        title={proximamente}
      />

      <FilterButton
        label={t("obra")}
        value={t("obraValor")}
        trailingIcon={
          <ChevronDown
            className="size-3.5 text-subtle-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
        }
        title={proximamente}
      />

      <FilterButton
        label={t("categoria")}
        value={t("categoriaValor")}
        trailingIcon={
          <ChevronDown
            className="size-3.5 text-subtle-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
        }
        title={proximamente}
      />

      {/* Granularity segmented control */}
      <div
        role="tablist"
        aria-label={t("granularidad.mes")}
        className="ml-auto inline-flex h-8 items-center rounded-lg border border-border bg-background p-0.5 text-[13px]"
      >
        {segments.map((seg) => {
          const active = seg.key === granularity;
          return (
            <button
              key={seg.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={!active || undefined}
              title={!active ? proximamente : undefined}
              className={cn(
                "h-7 rounded-md px-3 font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-subtle-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
