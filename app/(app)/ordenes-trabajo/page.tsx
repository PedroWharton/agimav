import { prisma } from "@/lib/db";
import { formatOTNumber } from "@/lib/ot/ot-number";
import type { CalendarEvent } from "@/components/ordenes/week-calendar";

import { OrdenesCalendarClient, type OtEventRow } from "./ordenes-calendar-client";

export const dynamic = "force-dynamic";

/**
 * OT → CalendarEvent mapping (R8-02):
 *
 * The OrdenTrabajo model only exposes `fechaCreacion` / `fechaFinalizacion`;
 * there is no scheduled-start, duration, or direct maquinaria relation
 * (those live on the sibling Mantenimiento table). We therefore use
 * `fechaCreacion` as the event start and a fixed 2h duration placeholder —
 * the calendar is a planning surface over creation dates, which matches how
 * the legacy team tracks OT load.
 *
 * All OTs map to tipo="mant" (the CalendarEventTipo closest to OT work).
 * The other tipos (inv/comp/log/ins) are reserved for future cross-module
 * events so the primitive stays generic.
 */

const DEFAULT_DURATION_HOURS = 2;

function parseMondayParam(raw: string | string[] | undefined): Date {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const match =
    typeof candidate === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate)
      : null;
  if (match) {
    const [, y, m, d] = match;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(parsed.getTime())) {
      return mondayOf(parsed);
    }
  }
  return mondayOf(new Date());
}

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0…Sun=6
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function OrdenesTrabajoListPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const params = await searchParams;
  const weekMonday = parseMondayParam(params.week);
  const weekEnd = new Date(weekMonday);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rows = await prisma.ordenTrabajo.findMany({
    where: {
      fechaCreacion: { gte: weekMonday, lt: weekEnd },
    },
    select: {
      id: true,
      numeroOt: true,
      titulo: true,
      fechaCreacion: true,
      estado: true,
      prioridad: true,
      responsable: { select: { id: true, nombre: true } },
      unidadProductiva: { select: { nombre: true } },
    },
    orderBy: { fechaCreacion: "asc" },
  });

  const events: OtEventRow[] = rows.map((o) => {
    const label = o.numeroOt ?? formatOTNumber(o.id);
    const title = `${label} · ${o.titulo}`;
    const subtitleParts = [o.responsable?.nombre, o.unidadProductiva?.nombre].filter(
      Boolean,
    );
    const event: CalendarEvent = {
      id: o.id,
      title,
      subtitle: subtitleParts.join(" · ") || undefined,
      start: o.fechaCreacion.toISOString(),
      durationHours: DEFAULT_DURATION_HOURS,
      tipo: "mant",
      href: `/ordenes-trabajo/${o.id}`,
    };
    return {
      event,
      responsableId: o.responsable?.id ?? null,
      responsable: o.responsable?.nombre ?? null,
      maquinaTitle: o.unidadProductiva?.nombre ?? o.titulo,
      estado: o.estado,
      prioridad: o.prioridad,
    };
  });

  return (
    <OrdenesCalendarClient
      weekStart={toIsoDate(weekMonday)}
      events={events}
      totalOts={rows.length}
    />
  );
}
