"use client";

import { useState } from "react";

import { CalendarLegend } from "@/components/ordenes/calendar-legend";
import { MiniMonth } from "@/components/ordenes/mini-month";
import type { CalendarEvent } from "@/components/ordenes/week-calendar";
import { WeekCalendar } from "@/components/ordenes/week-calendar";

/**
 * R8-01 demo: WeekCalendar + MiniMonth + CalendarLegend.
 * Not shipped as a user-facing route — lives here so typecheck + lint validate
 * every variant. R8-02 assembles the real Órdenes de trabajo page.
 */
export default function WeekCalendarDemoPage() {
  const [weekStart, setWeekStart] = useState<string>("2026-04-13");

  // Synthetic week Mon Apr 13 → Sun Apr 19 2026 (mirrors the design prototype).
  const events: CalendarEvent[] = [
    {
      id: 1,
      title: "OT-1038 · Cambio aceite motor",
      subtitle: "MAQ-042 · D. Flores",
      start: "2026-04-13T08:00",
      durationHours: 4,
      tipo: "mant",
      href: "#",
    },
    {
      id: 2,
      title: "Recepción lote filtros",
      subtitle: "OC-2024-0088 · Pañol",
      start: "2026-04-13T09:00",
      durationHours: 3,
      tipo: "inv",
      href: "#",
    },
    {
      id: 3,
      title: "OT-1035 · Reparación mangueras",
      subtitle: "MAQ-082 · C. Sánchez",
      start: "2026-04-13T14:00",
      durationHours: 5,
      tipo: "mant",
      href: "#",
    },
    {
      id: 4,
      title: "Inspección técnica obra Sur",
      subtitle: "Pedro Wharton",
      start: "2026-04-14T08:00",
      durationHours: 2,
      tipo: "ins",
    },
    {
      id: 5,
      title: "OT-1040 · Diagnóstico motor",
      subtitle: "MAQ-024 · C. Sánchez",
      start: "2026-04-14T10:00",
      durationHours: 6,
      tipo: "mant",
      href: "#",
    },
    {
      id: 6,
      title: "Traslado MAQ-017 → Obra Norte",
      subtitle: "Transporte · pluma",
      start: "2026-04-14T13:00",
      durationHours: 2,
      tipo: "log",
      href: "#",
    },
    {
      id: 7,
      title: "Reunión proveedor · Hidrorepuestos",
      subtitle: "OC-2024-0091",
      start: "2026-04-15T09:00",
      durationHours: 3,
      tipo: "comp",
      href: "#",
    },
    {
      id: 8,
      title: "OT-1047 · Reemplazo kit embrague",
      subtitle: "MAQ-017 · D. Flores (en curso)",
      start: "2026-04-17T08:00",
      durationHours: 12,
      tipo: "mant",
      href: "#",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          WeekCalendar primitive
        </h1>
        <p className="text-sm text-muted-foreground">
          Demo route for R8-01. Not shipped — lives here so typecheck + lint
          validate the calendar primitive. R8-02 consumes this to build the real
          Órdenes de trabajo page.
        </p>
      </header>

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "220px 1fr 220px" }}
      >
        {/* LEFT: mini-month + filter placeholder */}
        <aside className="flex flex-col gap-3">
          <MiniMonth
            month="2026-04-01"
            selectedWeekStart={weekStart}
            onSelectWeek={setWeekStart}
          />
          <div className="rounded-[10px] border border-border bg-card px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider">
              Semana seleccionada
            </div>
            <code className="font-mono text-[11px] text-foreground">
              {weekStart}
            </code>
          </div>
        </aside>

        {/* CENTER: legend + calendar */}
        <div className="flex flex-col gap-3">
          <CalendarLegend />
          <WeekCalendar
            weekStart={weekStart}
            events={events}
            onEventClick={(ev) => {
              console.log("Click:", ev.id, ev.title);
            }}
          />
        </div>

        {/* RIGHT: placeholder filter column */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-[10px] border border-border bg-card px-3 py-3">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filtros (R8-02)
            </div>
            <p className="text-[12px] text-muted-foreground">
              El panel de filtros se arma en R8-02 cuando se ensambla la página
              real. Este demo solo valida el primitive.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
