# 6 · Órdenes de trabajo — UX spec

Módulo `/ordenes-trabajo`. El form y el detalle heredan los patrones de
Mantenimiento (ver `docs/redesign-plan.md` §4.11, §4.12, §5.9, §5.10 y
`5-mantenimiento.md`). Este archivo documenta lo específico del módulo; hoy,
el calendario.

## Calendario semanal (día completo)

- La página principal es un calendario semanal por **días completos** — sin eje
  horario ni horas (`components/ordenes/week-day-calendar.tsx`): 7 columnas L-D
  con header (abreviatura + número de día, hoy resaltado en `brand`).
- Cada OT se dibuja como una **barra** que va de `fechaProgramada` (fallback
  `fechaCreacion`) hasta `fechaProgramada + duracionDias - 1` días
  (`duracionDias` null/0 ⇒ 1), clampeada a la semana visible; el borde recto
  (sin redondeo) en un extremo indica que la barra continúa fuera de la semana.
- Las barras se apilan en carriles (lanes) sin superponerse; colores por
  categoría vía `TIPO_STYLES` (tokens semánticos, hoy todas las OT = `mant`);
  click → detalle de la OT.
- Alrededor se mantienen: mini-month + filtros (categoría / responsable /
  búsqueda) a la izquierda, navegación de semana + leyenda arriba, y lista
  lateral "Próximas" a la derecha que muestra **solo fechas** ("lun 20 jul" o
  rango "lun 20 jul – mié 22 jul"), nunca HH:mm.
- Grilla anterior por horas: `week-calendar.tsx` queda solo para la demo
  `_demos/week-calendar` (spec histórica en `redesign-plan.md` §4.8).
