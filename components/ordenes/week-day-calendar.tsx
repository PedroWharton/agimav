"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { TIPO_STYLES, type CalendarEventTipo } from "./week-calendar";

/**
 * Day-based week calendar (Phase 9 rework of the OT calendar).
 *
 * A diferencia de `WeekCalendar` (grilla por horas, todavía usada por la demo
 * de `_demos/week-calendar`), acá los eventos son de día completo: cada uno
 * arranca en `startDate` y abarca `durationDays` días. No hay eje horario —
 * la semana son 7 columnas L-D y cada evento es una barra que puede cruzar
 * varias columnas (clampeada al rango visible de la semana).
 */

export type DayCalendarEvent = {
  id: string | number;
  title: string;
  subtitle?: string;
  /** ISO date (YYYY-MM-DD) of the first scheduled day. */
  startDate: string;
  /** Full days the event spans (>= 1; fractional values round up). */
  durationDays: number;
  tipo: CalendarEventTipo;
  href?: string;
};

export type WeekDayCalendarProps = {
  /** Monday of the week (ISO date, e.g. "2026-04-13"). */
  weekStart: string;
  events: DayCalendarEvent[];
  onEventClick?: (event: DayCalendarEvent) => void;
};

const HEADER_HEIGHT_PX = 32;
const LANE_MIN_HEIGHT_PX = 44;
const EMPTY_BODY_MIN_HEIGHT_PX = 160;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a YYYY-MM-DD (or ISO datetime) into a Date at local midnight. */
function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(iso);
}

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

/** Whole days from `monday` to `date` (both at local midnight). */
function dayOffset(monday: Date, date: Date): number {
  return Math.round((date.getTime() - monday.getTime()) / MS_PER_DAY);
}

type PlacedEvent = {
  event: DayCalendarEvent;
  /** 0-based first visible column. */
  colStart: number;
  /** 0-based last visible column (inclusive). */
  colEnd: number;
  /** True when the bar continues from before / past the visible week. */
  clippedStart: boolean;
  clippedEnd: boolean;
  /** 0-based stacking lane. */
  lane: number;
};

/**
 * Clamp events to the visible week and assign each a stacking lane so bars
 * never overlap: sorted by start (longer first), each takes the first lane
 * with no column conflict.
 */
function placeEvents(monday: Date, events: DayCalendarEvent[]): PlacedEvent[] {
  const candidates = events.flatMap((event) => {
    const start = dayOffset(monday, parseIsoDate(event.startDate));
    const duration = Math.max(1, Math.ceil(event.durationDays));
    const end = start + duration - 1;
    if (end < 0 || start > 6) return [];
    return [
      {
        event,
        colStart: Math.max(0, start),
        colEnd: Math.min(6, end),
        clippedStart: start < 0,
        clippedEnd: end > 6,
      },
    ];
  });

  candidates.sort(
    (a, b) =>
      a.colStart - b.colStart ||
      b.colEnd - b.colStart - (a.colEnd - a.colStart) ||
      String(a.event.id).localeCompare(String(b.event.id)),
  );

  const laneEnds: number[] = []; // last occupied column per lane
  return candidates.map((c) => {
    let lane = laneEnds.findIndex((end) => end < c.colStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(c.colEnd);
    } else {
      laneEnds[lane] = c.colEnd;
    }
    return { ...c, lane };
  });
}

export function WeekDayCalendar({
  weekStart,
  events,
  onEventClick,
}: WeekDayCalendarProps) {
  const t = useTranslations("calendar");

  const weekDays = buildWeekDays(weekStart);
  const monday = weekDays[0];
  const today = new Date();

  const dayAbbrev = [
    t("diasCortos.lun"),
    t("diasCortos.mar"),
    t("diasCortos.mie"),
    t("diasCortos.jue"),
    t("diasCortos.vie"),
    t("diasCortos.sab"),
    t("diasCortos.dom"),
  ];

  const placed = placeEvents(monday, events);

  return (
    <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        {/* Background day columns (borders + today highlight). */}
        <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-border last:border-r-0",
                sameYMD(day, today) && "bg-muted/40",
              )}
            />
          ))}
        </div>

        {/* Foreground: header row + stacked event lanes. */}
        <div
          className="relative grid grid-cols-7 pb-3"
          style={{
            gridTemplateRows: `${HEADER_HEIGHT_PX}px`,
            gridAutoRows: `minmax(${LANE_MIN_HEIGHT_PX}px, auto)`,
          }}
        >
          {weekDays.map((day, di) => {
            const isToday = sameYMD(day, today);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-2.5",
                  isToday && "bg-card/95",
                )}
                style={{
                  height: HEADER_HEIGHT_PX,
                  gridColumn: di + 1,
                  gridRow: 1,
                }}
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
            );
          })}

          {/* Keeps the body from collapsing when the week is empty. */}
          <div
            aria-hidden
            style={{
              gridColumn: "1 / -1",
              gridRow: 2,
              minHeight: placed.length === 0 ? EMPTY_BODY_MIN_HEIGHT_PX : 0,
            }}
          />

          {placed.map(({ event, colStart, colEnd, clippedStart, clippedEnd, lane }) => {
            const style = TIPO_STYLES[event.tipo];
            const classes = cn(
              "z-[1] m-1 flex min-w-0 flex-col justify-center overflow-hidden rounded-md border px-2 py-1 text-[11.5px] leading-tight",
              "border-l-[3px] transition-[transform,box-shadow] duration-[120ms]",
              "hover:-translate-y-[0.5px] hover:shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              "cursor-pointer no-underline",
              style.bg,
              style.text,
              style.border,
              // Flat edge signals the bar continues beyond the visible week.
              clippedStart && "ml-0 rounded-l-none",
              clippedEnd && "mr-0 rounded-r-none",
            );
            const positionStyle = {
              gridColumn: `${colStart + 1} / ${colEnd + 2}`,
              gridRow: lane + 2,
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
      </div>
    </div>
  );
}
