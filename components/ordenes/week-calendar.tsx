"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export type CalendarEventTipo = "mant" | "inv" | "comp" | "log" | "ins";

export type CalendarEvent = {
  id: string | number;
  title: string;
  subtitle?: string;
  /** ISO datetime. Must fall within the week the calendar is showing (caller responsibility). */
  start: string;
  /** hours, can be fractional. */
  durationHours: number;
  tipo: CalendarEventTipo;
  href?: string;
};

export type WeekCalendarProps = {
  /** Monday of the week (ISO date, e.g. "2026-04-13" or full ISO datetime). */
  weekStart: string;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  /** Earliest hour displayed (default 8). */
  startHour?: number;
  /** Latest hour displayed (default 18, exclusive — default grid covers 8:00–17:59). */
  endHour?: number;
};

/**
 * Color map by tipo — brand tokens only.
 * Matches spec §4.8:
 *   mant → warn, inv → info, comp → success, log → brand, ins → muted.
 */
export const TIPO_STYLES: Record<
  CalendarEventTipo,
  { bg: string; text: string; border: string; dot: string }
> = {
  mant: {
    bg: "bg-warn-weak",
    text: "text-warn",
    border: "border-warn/30",
    dot: "bg-warn",
  },
  inv: {
    bg: "bg-info-weak",
    text: "text-info",
    border: "border-info/30",
    dot: "bg-info",
  },
  comp: {
    bg: "bg-success-weak",
    text: "text-success",
    border: "border-success/30",
    dot: "bg-success",
  },
  log: {
    bg: "bg-brand-weak",
    text: "text-brand",
    border: "border-brand/30",
    dot: "bg-brand",
  },
  ins: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "bg-muted-foreground",
  },
};

const HEADER_HEIGHT_PX = 32;
const ROW_HEIGHT_PX = 48;

/** Parse a YYYY-MM-DD or ISO datetime into a Date at local midnight for the date portion. */
function parseIsoDate(iso: string): Date {
  // If it's a bare date YYYY-MM-DD, construct as local to avoid TZ surprises.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(iso);
}

/** Compute the 7 days starting from Monday of the given weekStart. */
function buildWeekDays(weekStart: string): Date[] {
  const monday = parseIsoDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Given a column's events, assign each a column slot (0 or 1) for 2-wide overlap handling. */
function assignOverlapSlots(
  events: (CalendarEvent & { _startHour: number; _endHour: number })[],
): { event: CalendarEvent; slot: 0 | 1; ofN: 1 | 2 }[] {
  // Sort by start hour then duration (longer first for stable layout).
  const sorted = [...events].sort(
    (a, b) =>
      a._startHour - b._startHour ||
      b._endHour - b._startHour - (a._endHour - a._startHour),
  );

  const placed: {
    event: CalendarEvent;
    slot: 0 | 1;
    ofN: 1 | 2;
    _startHour: number;
    _endHour: number;
  }[] = [];

  for (const ev of sorted) {
    // Find any overlap in the already-placed set.
    const overlaps = placed.filter(
      (p) => p._startHour < ev._endHour && p._endHour > ev._startHour,
    );
    let slot: 0 | 1 = 0;
    if (overlaps.some((o) => o.slot === 0)) slot = 1;
    // If both slots are taken, we stack in slot 1 anyway (rare edge case — acceptable per spec).
    placed.push({
      event: ev,
      slot,
      ofN: overlaps.length > 0 ? 2 : 1,
      _startHour: ev._startHour,
      _endHour: ev._endHour,
    });
  }

  // Promote siblings of a 2-wide group: if any event in the overlap cluster is 2-wide,
  // its overlapping peers should also render as 2-wide for symmetry.
  for (const p of placed) {
    const peers = placed.filter(
      (q) => q._startHour < p._endHour && q._endHour > p._startHour,
    );
    if (peers.some((q) => q.ofN === 2)) {
      p.ofN = 2;
    }
  }

  return placed.map(({ event, slot, ofN }) => ({ event, slot, ofN }));
}

export function WeekCalendar({
  weekStart,
  events,
  onEventClick,
  startHour: startHourProp = 8,
  endHour: endHourProp = 18,
}: WeekCalendarProps) {
  const t = useTranslations("calendar");

  const weekDays = buildWeekDays(weekStart);
  const today = new Date();

  // Auto-expand the visible range to cover events outside [startHour, endHour],
  // clamped to [0, 24]. Default still 8–18 when no events fall outside.
  let startHour = startHourProp;
  let endHour = endHourProp;
  for (const ev of events) {
    const evStart = new Date(ev.start);
    const sh = evStart.getHours() + evStart.getMinutes() / 60;
    const eh = sh + ev.durationHours;
    if (sh < startHour) startHour = Math.max(0, Math.floor(sh));
    if (eh > endHour) endHour = Math.min(24, Math.ceil(eh));
  }
  const hourCount = Math.max(1, endHour - startHour);

  const dayAbbrev = [
    t("diasCortos.lun"),
    t("diasCortos.mar"),
    t("diasCortos.mie"),
    t("diasCortos.jue"),
    t("diasCortos.vie"),
    t("diasCortos.sab"),
    t("diasCortos.dom"),
  ];

  // Bucket events per day.
  const eventsByDay: CalendarEvent[][] = weekDays.map(() => []);
  for (const ev of events) {
    const evStart = new Date(ev.start);
    const idx = weekDays.findIndex((d) => sameYMD(d, evStart));
    if (idx >= 0) eventsByDay[idx].push(ev);
  }

  const gridHeightPx = HEADER_HEIGHT_PX + hourCount * ROW_HEIGHT_PX;

  return (
    <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card">
      <div
        className="grid"
        style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
      >
        {/* TIME GUTTER */}
        <div
          className="relative border-r border-border bg-muted"
          style={{ height: gridHeightPx }}
        >
          <div
            className="border-b border-border"
            style={{ height: HEADER_HEIGHT_PX }}
            aria-hidden
          />
          {Array.from({ length: hourCount }, (_, i) => {
            const hour = startHour + i;
            return (
              <div
                key={hour}
                className="border-b border-dashed border-border px-1.5 pt-1 text-right font-mono text-[10px] text-muted-foreground"
                style={{ height: ROW_HEIGHT_PX }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            );
          })}
        </div>

        {/* DAY COLUMNS */}
        {weekDays.map((day, di) => {
          const isToday = sameYMD(day, today);
          const dayEventsRaw = eventsByDay[di];
          const dayEventsAnnotated = dayEventsRaw.map((ev) => {
            const evStart = new Date(ev.start);
            const startHours =
              evStart.getHours() + evStart.getMinutes() / 60;
            return {
              ...ev,
              _startHour: startHours,
              _endHour: startHours + ev.durationHours,
            };
          });
          const placed = assignOverlapSlots(dayEventsAnnotated);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative border-r border-border last:border-r-0",
                isToday && "bg-muted/40",
              )}
              style={{ height: gridHeightPx }}
            >
              {/* Header */}
              <div
                className={cn(
                  "sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-2.5",
                  isToday && "bg-card/95",
                )}
                style={{ height: HEADER_HEIGHT_PX }}
              >
                <span
                  className={cn(
                    "font-mono text-[10px] font-semibold uppercase tracking-wider",
                    isToday ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {dayAbbrev[di]}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isToday ? "text-brand" : "text-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Hour slots */}
              {Array.from({ length: hourCount }, (_, i) => (
                <div
                  key={i}
                  className="border-b border-dashed border-border"
                  style={{ height: ROW_HEIGHT_PX }}
                  aria-hidden
                />
              ))}

              {/* Events */}
              {placed.map(({ event, slot, ofN }) => {
                const evStart = new Date(event.start);
                const evStartHour =
                  evStart.getHours() + evStart.getMinutes() / 60;
                const top =
                  HEADER_HEIGHT_PX + (evStartHour - startHour) * ROW_HEIGHT_PX;
                const rawHeight = event.durationHours * ROW_HEIGHT_PX - 4;
                // Clip: if event extends past endHour, trim the height.
                const maxHeight = gridHeightPx - top - 4;
                const height = Math.max(
                  18,
                  Math.min(rawHeight, maxHeight),
                );

                const style = TIPO_STYLES[event.tipo];
                const leftPct = ofN === 2 ? (slot === 0 ? 0 : 50) : 0;
                const widthPct = ofN === 2 ? 50 : 100;

                const classes = cn(
                  "absolute overflow-hidden rounded-md border px-2 py-1 text-[11.5px] leading-tight",
                  "border-l-[3px] transition-[transform,box-shadow] duration-[120ms]",
                  "hover:-translate-y-[0.5px] hover:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  "cursor-pointer no-underline",
                  style.bg,
                  style.text,
                  style.border,
                );

                const positionStyle = {
                  top,
                  height,
                  left: `calc(${leftPct}% + 4px)`,
                  width: `calc(${widthPct}% - 8px)`,
                };

                const inner = (
                  <>
                    <div className="truncate font-semibold">{event.title}</div>
                    {event.subtitle ? (
                      <div className="mt-0.5 truncate font-mono text-[10px] opacity-80">
                        {event.subtitle}
                      </div>
                    ) : null}
                  </>
                );

                if (event.href) {
                  return (
                    <Link
                      key={event.id}
                      href={event.href}
                      className={classes}
                      style={positionStyle}
                      onClick={() => onEventClick?.(event)}
                    >
                      {inner}
                    </Link>
                  );
                }

                const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEventClick?.(event);
                  }
                };

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={cn(classes, "text-left")}
                    style={positionStyle}
                    onClick={() => onEventClick?.(event)}
                    onKeyDown={handleKey}
                    tabIndex={0}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
