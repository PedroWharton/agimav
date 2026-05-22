import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireViewOrRedirect } from "@/lib/rbac";
import { accessibleUpIds } from "@/lib/up-scope";
import { formatOTNumber } from "@/lib/ot/ot-number";
import type { CalendarEvent } from "@/components/ordenes/week-calendar";

import { OrdenesCalendarClient, type OtEventRow } from "./ordenes-calendar-client";

export const dynamic = "force-dynamic";

/**
 * OT → CalendarEvent mapping:
 *
 * WS-C added `fechaProgramada` (scheduled date) and `duracionDias` to the
 * OrdenTrabajo model. The calendar now plots each OT by `fechaProgramada`
 * when set, falling back to `fechaCreacion`. An OT with a scheduled date
 * renders as a full-day block ("día completo"); otherwise a 2h placeholder.
 *
 * All OTs map to tipo="mant" (the CalendarEventTipo closest to OT work).
 * The other tipos (inv/comp/log/ins) are reserved for future cross-module
 * events so the primitive stays generic.
 */

const DEFAULT_DURATION_HOURS = 2;
const FULL_DAY_HOURS = 8;

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
  const session = await auth();
  requireViewOrRedirect(session, "ot.view");

  const params = await searchParams;
  const weekMonday = parseMondayParam(params.week);
  const weekEnd = new Date(weekMonday);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // WS-B3: scoping per-UP. Si hay asignaciones, se ven las OTs de esas UPs
  // más las sin UP; `null` ⇒ sin restricción.
  const ups = await accessibleUpIds(session);

  // La OT cae en la semana por su fecha programada; si no tiene, por la de
  // creación.
  const enLaSemana = {
    OR: [
      { fechaProgramada: { gte: weekMonday, lt: weekEnd } },
      {
        fechaProgramada: null,
        fechaCreacion: { gte: weekMonday, lt: weekEnd },
      },
    ],
  };

  const rows = await prisma.ordenTrabajo.findMany({
    where: {
      AND: [
        enLaSemana,
        ...(ups
          ? [
              {
                OR: [
                  { unidadProductivaId: { in: ups } },
                  { unidadProductivaId: null },
                ],
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      numeroOt: true,
      titulo: true,
      fechaCreacion: true,
      fechaProgramada: true,
      duracionDias: true,
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
      start: (o.fechaProgramada ?? o.fechaCreacion).toISOString(),
      durationHours:
        o.fechaProgramada != null ? FULL_DAY_HOURS : DEFAULT_DURATION_HOURS,
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
