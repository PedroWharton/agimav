"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageHeader } from "@/components/app/page-header";
import { CalendarLegend } from "@/components/ordenes/calendar-legend";
import { MiniMonth } from "@/components/ordenes/mini-month";
import {
  type CalendarEvent,
  type CalendarEventTipo,
  TIPO_STYLES,
  WeekCalendar,
} from "@/components/ordenes/week-calendar";
import { cn } from "@/lib/utils";

export type OtEventRow = {
  event: CalendarEvent;
  responsableId: number | null;
  responsable: string | null;
  maquinaTitle: string;
  estado: string;
  prioridad: string;
};

const ALL_TIPOS: CalendarEventTipo[] = ["mant", "inv", "comp", "log", "ins"];
const ALL_RESPONSABLES = "__all__";

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

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

export function OrdenesCalendarClient({
  weekStart,
  events,
  totalOts,
}: {
  weekStart: string;
  events: OtEventRow[];
  totalOts: number;
}) {
  const tO = useTranslations("ordenesTrabajo");
  const tCal = useTranslations("ordenesTrabajo.calendario");
  const tTipos = useTranslations("calendar.tipos");
  const tMeses = useTranslations("calendar.meses");
  const router = useRouter();

  const [visibleTipos, setVisibleTipos] = useState<Set<CalendarEventTipo>>(
    new Set(ALL_TIPOS),
  );
  const [responsableFilter, setResponsableFilter] = useState<string>(
    ALL_RESPONSABLES,
  );
  const [maquinaQuery, setMaquinaQuery] = useState<string>("");

  const mondayDate = parseIsoDate(weekStart);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(sundayDate.getDate() + 6);

  // Distinct responsables visible in the week (keyed by id; fallback name-only).
  const responsables = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of events) {
      if (row.responsableId == null || !row.responsable) continue;
      map.set(String(row.responsableId), row.responsable);
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const needle = maquinaQuery.trim().toLowerCase();
    return events
      .filter((row) => visibleTipos.has(row.event.tipo))
      .filter((row) =>
        responsableFilter === ALL_RESPONSABLES
          ? true
          : String(row.responsableId ?? "") === responsableFilter,
      )
      .filter((row) =>
        needle.length === 0
          ? true
          : row.maquinaTitle.toLowerCase().includes(needle) ||
            row.event.title.toLowerCase().includes(needle),
      )
      .map((row) => row.event);
  }, [events, visibleTipos, responsableFilter, maquinaQuery]);

  const tipoCounts = useMemo(() => {
    const counts: Record<CalendarEventTipo, number> = {
      mant: 0,
      inv: 0,
      comp: 0,
      log: 0,
      ins: 0,
    };
    for (const row of events) counts[row.event.tipo] += 1;
    return counts;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    return [...filteredEvents]
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      )
      .slice(0, 10);
  }, [filteredEvents]);

  function navigateToWeek(newMonday: Date) {
    const iso = toIsoDate(newMonday);
    router.push(`/ordenes-trabajo?week=${iso}`);
  }

  function handlePrev() {
    const prev = new Date(mondayDate);
    prev.setDate(prev.getDate() - 7);
    navigateToWeek(prev);
  }

  function handleNext() {
    const next = new Date(mondayDate);
    next.setDate(next.getDate() + 7);
    navigateToWeek(next);
  }

  function handleToday() {
    navigateToWeek(mondayOf(new Date()));
  }

  function toggleTipo(tipo: CalendarEventTipo) {
    setVisibleTipos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) {
        next.delete(tipo);
      } else {
        next.add(tipo);
      }
      return next;
    });
  }

  const rangeLabel = formatRange(mondayDate, sundayDate, tMeses);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={tO("titulo")}
        description={tCal("descripcion", { count: totalOts })}
        actions={
          <Button asChild>
            <Link href="/ordenes-trabajo/nuevo">
              <Plus className="size-4" />
              {tO("nueva")}
            </Link>
          </Button>
        }
      />

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "220px 1fr 220px" }}
      >
        {/* LEFT: mini-month + filters */}
        <aside className="flex flex-col gap-3">
          <MiniMonth
            month={weekStart}
            selectedWeekStart={weekStart}
            onSelectWeek={(mondayIso) => navigateToWeek(parseIsoDate(mondayIso))}
          />

          <div className="rounded-[10px] border border-border bg-card px-3 py-3">
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tCal("filtros.categorias")}
            </h3>
            <div className="flex flex-col gap-1.5">
              {ALL_TIPOS.map((tipo) => {
                const style = TIPO_STYLES[tipo];
                const checked = visibleTipos.has(tipo);
                return (
                  <label
                    key={tipo}
                    className="flex cursor-pointer items-center gap-2 text-[12.5px]"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleTipo(tipo)}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block size-2.5 rounded-[3px] border-l-[3px]",
                        style.bg,
                        style.border,
                      )}
                    />
                    <span className="flex-1">{tTipos(tipo)}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {tipoCounts[tipo]}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-[10px] border border-border bg-card px-3 py-3">
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tCal("filtros.responsable")}
            </h3>
            <Select
              value={responsableFilter}
              onValueChange={setResponsableFilter}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder={tCal("filtros.todos")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_RESPONSABLES}>
                  {tCal("filtros.todos")}
                </SelectItem>
                {responsables.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-[10px] border border-border bg-card px-3 py-3">
            <Label
              htmlFor="maquina-filter"
              className="mb-2 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {tCal("filtros.maquina")}
            </Label>
            <Input
              id="maquina-filter"
              value={maquinaQuery}
              onChange={(e) => setMaquinaQuery(e.target.value)}
              placeholder={tCal("filtros.maquinaPlaceholder")}
              className="h-8"
            />
          </div>
        </aside>

        {/* CENTER: nav + legend + calendar */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label={tCal("nav.anterior")}
                  className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="rounded px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {tCal("nav.hoy")}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label={tCal("nav.siguiente")}
                  className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <span className="text-[15px] font-medium text-foreground">
                {rangeLabel.range}
              </span>
              <span className="font-mono text-[12.5px] text-muted-foreground">
                {rangeLabel.year}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {tCal("eventosCount", { count: filteredEvents.length })}
            </span>
          </div>

          <CalendarLegend
            visibleTipos={Array.from(visibleTipos) as CalendarEventTipo[]}
          />

          <WeekCalendar weekStart={weekStart} events={filteredEvents} />
        </div>

        {/* RIGHT: upcoming list */}
        <aside className="flex min-h-0 flex-col gap-3">
          <div className="flex max-h-[640px] flex-col overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="border-b border-border px-3 py-2.5">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tCal("proximas.titulo")}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {tCal("proximas.subtitulo", {
                  count: upcomingEvents.length,
                })}
              </p>
            </div>
            <div className="flex flex-col divide-y divide-border overflow-y-auto">
              {upcomingEvents.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                  {tCal("proximas.vacio")}
                </div>
              ) : (
                upcomingEvents.map((ev) => {
                  const style = TIPO_STYLES[ev.tipo];
                  return (
                    <Link
                      key={ev.id}
                      href={ev.href ?? `/ordenes-trabajo/${ev.id}`}
                      className="group flex gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1 inline-block h-8 w-1 shrink-0 rounded-sm",
                          style.dot,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-foreground">
                          {ev.title}
                        </p>
                        {ev.subtitle ? (
                          <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                            {ev.subtitle}
                          </p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {format(new Date(ev.start), "EEE dd MMM · HH:mm", {
                            locale: es,
                          })}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatRange(
  monday: Date,
  sunday: Date,
  tMeses: (key: string) => string,
): { range: string; year: string } {
  const startMonth = tMeses(String(monday.getMonth() + 1));
  const endMonth = tMeses(String(sunday.getMonth() + 1));
  const startDay = monday.getDate();
  const endDay = sunday.getDate();
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const sameYear = monday.getFullYear() === sunday.getFullYear();

  let range: string;
  if (sameMonth) {
    range = `${startDay} – ${endDay} ${startMonth}`;
  } else if (sameYear) {
    range = `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  } else {
    range = `${startDay} ${startMonth} ${monday.getFullYear()} – ${endDay} ${endMonth} ${sunday.getFullYear()}`;
  }
  return {
    range,
    year: sameYear
      ? String(monday.getFullYear())
      : `${monday.getFullYear()} / ${sunday.getFullYear()}`,
  };
}
