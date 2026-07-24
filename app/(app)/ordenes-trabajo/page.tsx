import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireViewOrRedirect } from "@/lib/rbac";
import { accessibleUpIds } from "@/lib/up-scope";
import { formatOTNumber } from "@/lib/ot/ot-number";
import type { DayCalendarEvent } from "@/components/ordenes/week-day-calendar";

import { OrdenesCalendarClient, type OtEventRow } from "./ordenes-calendar-client";

export const dynamic = "force-dynamic";

/**
 * OT → DayCalendarEvent mapping:
 *
 * WS-C added `fechaProgramada` (scheduled date) and `duracionDias` to the
 * OrdenTrabajo model. The calendar plots each OT as a full-day bar starting
 * at `fechaProgramada` (falling back to `fechaCreacion`) and spanning
 * `duracionDias` days (null/0 ⇒ 1). No intra-day times anywhere.
 *
 * All OTs map to tipo="mant" (the CalendarEventTipo closest to OT work).
 * The other tipos (inv/comp/log/ins) are reserved for future cross-module
 * events so the primitive stays generic.
 */

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

  // La OT cae en la semana si su barra [fechaProgramada, fechaProgramada +
  // duracionDias) toca la semana. Prisma no puede expresar `fecha + duración`
  // en el where, así que la query trae las candidatas (programadas antes del
  // fin de semana visible) y el recorte exacto por duración se hace en JS —
  // el volumen de OTs es chico (decenas), no vale SQL crudo. Las OTs sin
  // fecha programada caen en la semana por su fecha de creación, como antes.
  const enLaSemana = {
    OR: [
      { fechaProgramada: { lt: weekEnd } },
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

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const events: OtEventRow[] = [];
  for (const o of rows) {
    // `fechaProgramada` se guarda como medianoche UTC de la fecha elegida en
    // el form ⇒ la fecha calendario es la porción UTC del timestamp.
    const startIso = (o.fechaProgramada ?? o.fechaCreacion)
      .toISOString()
      .slice(0, 10);
    const durationDays = Math.max(1, Math.ceil(o.duracionDias ?? 1));

    // Recorte exacto: la barra [offset, offset + duración - 1] tiene que
    // tocar los días visibles [0, 6].
    const [y, m, d] = startIso.split("-").map(Number);
    const startLocal = new Date(y, m - 1, d);
    const offset = Math.round(
      (startLocal.getTime() - weekMonday.getTime()) / MS_PER_DAY,
    );
    if (offset > 6 || offset + durationDays - 1 < 0) continue;

    const label = o.numeroOt ?? formatOTNumber(o.id);
    const title = `${label} · ${o.titulo}`;
    const subtitleParts = [o.responsable?.nombre, o.unidadProductiva?.nombre].filter(
      Boolean,
    );
    const event: DayCalendarEvent = {
      id: o.id,
      title,
      subtitle: subtitleParts.join(" · ") || undefined,
      startDate: startIso,
      durationDays,
      tipo: "mant",
      href: `/ordenes-trabajo/${o.id}`,
    };
    events.push({
      event,
      responsableId: o.responsable?.id ?? null,
      responsable: o.responsable?.nombre ?? null,
      maquinaTitle: o.unidadProductiva?.nombre ?? o.titulo,
      estado: o.estado,
      prioridad: o.prioridad,
    });
  }

  return (
    <OrdenesCalendarClient
      weekStart={toIsoDate(weekMonday)}
      events={events}
      totalOts={events.length}
    />
  );
}
