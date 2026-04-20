"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type MiniMonthProps = {
  /** First of the month (YYYY-MM-01 or similar ISO). */
  month: string;
  /** Currently-highlighted week start (Monday ISO). */
  selectedWeekStart?: string;
  onSelectWeek: (mondayIso: string) => void;
};

function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(iso);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // JS: Sun=0, Mon=1, ... Sat=6. We want Mon=0 offset.
  const dayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MiniMonth({
  month,
  selectedWeekStart,
  onSelectWeek,
}: MiniMonthProps) {
  const t = useTranslations("calendar");

  const initialMonthDate = useMemo(() => {
    const parsed = parseIsoDate(month);
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }, [month]);

  const [viewDate, setViewDate] = useState<Date>(initialMonthDate);

  const monthLabel = t(`meses.${viewDate.getMonth() + 1}`);
  const yearLabel = String(viewDate.getFullYear());

  const selectedMonday = selectedWeekStart
    ? mondayOf(parseIsoDate(selectedWeekStart))
    : null;
  const today = new Date();

  // Build the 6-week grid starting from Monday of the week that contains day 1.
  const firstOfMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1,
  );
  const gridStart = mondayOf(firstOfMonth);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  // Trim trailing full-empty row if the last row is entirely in the next month.
  const trimmed = cells.slice(0, 42);
  const lastRowStart = trimmed[35];
  const rows = lastRowStart.getMonth() !== viewDate.getMonth() ? 5 : 6;
  const finalCells = cells.slice(0, rows * 7);

  const dowLabels = ["L", "M", "X", "J", "V", "S", "D"] as const;

  const handlePrev = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const handleNext = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2.5 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold capitalize text-foreground">
          {monthLabel} {yearLabel}
        </span>
        <span className="inline-flex gap-0.5">
          <button
            type="button"
            onClick={handlePrev}
            aria-label={t("mesAnterior")}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label={t("mesSiguiente")}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-[2px] text-center">
        {dowLabels.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="py-0.5 text-[9.5px] tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {finalCells.map((cellDate) => {
          const inMonth = cellDate.getMonth() === viewDate.getMonth();
          const cellMonday = mondayOf(cellDate);
          const isSelectedWeek =
            selectedMonday && sameYMD(cellMonday, selectedMonday);
          const isToday = sameYMD(cellDate, today);

          return (
            <button
              key={toIsoDate(cellDate)}
              type="button"
              onClick={() => onSelectWeek(toIsoDate(cellMonday))}
              className={cn(
                "relative rounded px-0 py-1 font-mono text-[11px] leading-tight transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                !inMonth && "text-muted-foreground/60",
                inMonth && !isToday && "text-foreground",
                isSelectedWeek && !isToday && "bg-brand-weak font-semibold text-brand ring-1 ring-brand/40",
                isToday &&
                  "bg-brand font-semibold text-[color:var(--accent-on-primary,white)]",
              )}
            >
              {cellDate.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
