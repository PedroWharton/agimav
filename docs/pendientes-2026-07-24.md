# Revisión de pendientes — 2026-07-24

Auditoría completa de lo que quedó a medio hacer, cruzando: `post-cutover-backlog.md`,
`phase9-plan.md`, `qa-observations.md`, `runbook-migraciones-pendientes.md`,
`redesign-plan.md`, las notas personales de Pedro, el git log y el estado real de la
base (`prisma migrate status` → "up to date", 23/23 migraciones aplicadas).

Contexto: cutover realizado el 2026-05-21. Hoy es día ~64 post-cutover.

---

## 1. Notas de Pedro — estado real (auditado contra código, 2026-07-24)

> Segunda pasada: 5 agentes auditaron cada requisito contra el código real (no contra
> los commits). Resultado: **la mayoría verifica, pero 4 ítems NO cumplen y 8 están a
> medias.** El detalle con file:line está en §1.1. La tabla de abajo refleja el
> veredicto auditado, no el "figura como hecho".

| Nota | Veredicto auditado |
|---|---|
| Crear niveles de maquinaria + toggle esPrincipal | ✅ VERIFICADO (`structure-tree.tsx:145,932`; alta al final del árbol) |
| Aprobar solicitudes desde Borrador | ✅ VERIFICADO (`solicitudes/actions.ts:360` + UI) |
| OC sin precio | ✅ VERIFICADO (se emite en 0 y queda pendiente; `oc/actions.ts:105`) |
| Recepciones: sacar link OC, volver a recepciones, modal quién recibe | ✅ VERIFICADO (las 3 cosas) |
| **Cambiar proveedor con dropdown en recepción** | ❌ **NO CUMPLE** — solo hay filtro de lista; el proveedor se deriva de la OC y no se puede cambiar |
| Factura sobre varios remitos del mismo proveedor | ✅ VERIFICADO (selección múltiple + `?ocs=` + backend multi-OC) |
| Recepción sobre OC en distintos momentos | ✅ VERIFICADO (recepciones parciales) |
| Completar remito sin factura registrando precio | ✅ VERIFICADO (`recepciones/actions.ts:268-302` — escribe `PrecioHistorico`, `precioUnitario`, actualiza costo promedio) |
| Doble botón seleccionar máquina | ✅ VERIFICADO (`machine-chip.tsx:48-57`) |
| **Crear mantenimiento como iniciado/finalizado** | ⚠️ **PARCIAL** — el estado inicial existe, pero al crear como Finalizado **no hay campos de cierre y NO se consumen insumos ni se descuenta stock** (`createMantenimiento` nunca llama a `commitInsumosConsumption`; repuestos quedan con `cantidadUtilizada: 0`) |
| Plantilla: tipo libre (preventivo/correctivo) | ✅ VERIFICADO |
| Revisión = mismo mantenimiento + repetir N veces | ✅ VERIFICADO (+ bug menor: el ciclo recurrente crea la revisión con `estado:"realizada"` pero el panel chequea `"hecha"` → aparece como pendiente) |
| Tablero default + filtros etiquetados | ✅ VERIFICADO |
| **Precios pendientes (pantalla + propagación desde factura)** | ⚠️ **PARCIAL** — mantenimiento cubierto; **OT quedó afuera por completo**: `OtInsumo.precioPendiente` no aparece en `/compras/precios-pendientes` ni se resuelve al cargar factura |
| N° orden interna en compras | ⚠️ VERIFICADO en form + detalle de OC; **falta en el PDF** (`oc-pdf.tsx:195-204`) |
| **Crear item de inventario desde OC** | ⚠️ **PARCIAL** — el modal existe pero solo desde el editor de requisiciones; `allowCreate={false}` en todos los combobox y no hay alta desde la OC |
| **Notas en OC (por línea + cabecera)** | ❌ **NO CUMPLE** — `OrdenCompraDetalle.nota` no existe en el schema (lo visible es la nota de la requisición, read-only) y `observaciones` de cabecera no es editable desde ningún form |
| OT sin máquina, fecha programada + duración, sin horario | ⚠️ **PARCIAL** — form OK (fecha + días, sin hora), pero el **calendario ignora `duracionDias`**: dibuja bloque fijo de 8 h en grilla horaria con HH:mm |
| Categorías de OT con "Otros" | ✅ VERIFICADO |
| Dashboard: sacar OTIF y heatmap, KPI "Gastos" | ⚠️ **PARCIAL** — OTIF/heatmap removidos (queda código muerto en `dashboard.ts`), pero el KPI "Gastos" es **solo un rename**: sigue sumando únicamente `factura.aggregate`, no incluye costos cargados sin factura ni insumos valorizados |
| **Gasto/trazabilidad por usuario: "totalizar y detalle"** | ⚠️ **PARCIAL** — el totalizado está; **no hay drilldown por usuario** (qué facturas/requisiciones componen cada número) ni filtro dedicado por solicitante en solicitudes (solo búsqueda de texto libre, sin link cruzado) |
| Movimientos diarios (consumible/herramienta) | ✅ VERIFICADO (líneas mixtas, salida/devolución/reverso transaccionales) |
| **Localidad → UP + permisos per-UP** | ⚠️ **PARCIAL** — merge de Localidad completo y scoping de lectura OK (Mant + OT), pero: (a) las **server actions de mutación no revalidan scope** (8 de mantenimiento + 4 de OT — editar por id ajeno pasa); (b) **MovimientoDiario tiene FK de UP y no está scopeado**; (c) Requisiciones/Inventario usan UP-texto sin filtro |
| Servicios externos (catálogo + líneas en mant/OT) | ✅ VERIFICADO |

### 1.1 Fixes que salen de la auditoría (ordenados por gravedad)

1. **Crear mantenimiento Finalizado no descuenta stock** — es el único con riesgo de
   datos: cada alta directa en Finalizado con repuestos deja el inventario sin
   descontar. Fix: invocar el mismo `commitInsumosConsumption` de `transitionEstado`
   dentro de `createMantenimiento` (+ campos de cierre en el form).
2. **Notas en OC** — agregar `OrdenCompraDetalle.nota` (migración aditiva) + edición de
   `observaciones` de cabecera en el form de emisión, y mostrarlas en detalle + PDF.
3. **Precios pendientes de OT** — incluir `OtInsumo` en `/compras/precios-pendientes` y
   en la propagación de `createFactura` (la columna ya existe, es solo cablearla).
4. **Scoping UP en mutaciones + movimientos diarios** — guard `canAccessUp` al inicio
   de las 12 actions listadas; scopear el listado de `/movimientos-diarios` (tiene FK).
5. **Detalle por usuario en `/estadisticas/usuarios`** — drilldown (expandir fila o
   subruta) con las facturas/requisiciones que componen el número + link a solicitudes
   pre-filtradas por solicitante.
6. **KPI "Gastos" real** — decidir la definición (facturas + cierres sin factura +
   ¿insumos valorizados?) y ampliar la query de `dashboard.ts:108`.
7. **Calendario de OT por días** — plotear `fechaProgramada + duracionDias` como tramo
   de N días completos (hoy: bloque fijo 8 h en grilla horaria).
8. **Crear item desde OC** — habilitar la alta rápida también en el flujo de OC (o
   `allowCreate` en el combobox de líneas).
9. **Cambiar proveedor en recepción** — definir el caso de uso real con Cervi: la
   recepción deriva el proveedor de la OC, ¿cuándo haría falta cambiarlo?
10. **N° orden interna en el PDF de OC** — una línea en `oc-pdf.tsx`.
11. **Bug menor revisión recurrente** — unificar `"realizada"` vs `"hecha"` en el
    estado de `MantenimientoRevision`.
12. **Limpieza**: borrar `loadOtif*` / `loadHorasParadaHeatmap` muertos en
    `lib/stats/dashboard.ts`.

---

## 2. Vencidos / triggers cumplidos — esto es lo que toca ahora

Ordenado por urgencia. Los tres primeros son de la categoría "immediately" del backlog
y siguen sin hacerse a 2 meses del cutover.

1. **Base de desarrollo separada de producción** — sigue habiendo una sola base Neon;
   `.env.local` apunta a prod. El riesgo ya se materializó una vez (migraciones de
   `feat/asistente-ia` aplicadas a prod por accidente). Crear branch Neon de dev,
   apuntar `.env.local` ahí, documentar. **Es el ítem #1.**
2. **Guard de seguridad en `prisma/seed.ts`** — ~10 líneas: negarse a correr si la URL
   parece prod / falta `ALLOW_SEED`. Hoy la única protección es disciplina.
3. **Error tracking** — Sentry/Highlight/Axiom, medio día. Seguimos sin visibilidad de
   errores en prod salvo mirar logs de Vercel a mano.
4. **Neon backup cadence** — verificar que el PITR sea ≥7 días; considerar dumps
   programados. Nunca se verificó.
5. **"Cargar TC" (cotización USD)** — trigger probablemente cumplido: las 4 cotizaciones
   migradas cubren dic-2025 → abr-2026 y ya estamos en julio. `/estadisticas/precios`
   debe estar mostrando banda "aproximado" en todo lo reciente. Verificar y, si es así,
   hacer el form admin para cargar cotizaciones.
6. **SMTP / olvidé-mi-contraseña** — trigger cumplido: el umbral era ~15 usuarios y hay
   **34 activos** (probe WS-B). Wire Resend/Postmark + link en login.
7. **Re-evaluación de Evolución de precios** — estaba agendada para ≈2026-07-19 (ya
   pasó). Medir cuántos ítems tienen ≥2 puntos de precio hoy (eran 14/672); decidir si
   la vista se mantiene, se demota o se fusiona en el drilldown de proveedor.
8. **Normalización de `estado` a enums Prisma** — la ventana planificada era días 30–60
   post-cutover: es **ahora** (día 64). Migración de datos programada, tocar todos los
   callsites, QA de regresión. WS-C/WS-D agregaron estados nuevos, así que el drift de
   strings siguió creciendo — cuanto más se posterga, más caro.
9. **Cadencia de triage del backlog** — el plan era re-leer el backlog cada lunes por
   30 días + deep-review al día 30 (≈2026-06-20, no consta que se haya hecho). Esta
   revisión cuenta como el deep-review atrasado; agendar el del día 90 (≈2026-08-19).

## 3. Decisiones de producto pendientes (preguntar a Cervi)

- **Umbral de discrepancia precio factura vs OC** — hoy `PriceDiscrepancyBadge` avisa
  ante cualquier diferencia. ¿Exacto, ±1%, ±5%, configurable por proveedor? (Backlog
  decía "preguntar en el primer walkthrough contable".)
- **QA-006** — ¿agregar un insumo antes de finalizar debe escribir historial? (Hoy solo
  escribe al finalizar, que es lo que decía el spec; falta confirmación.)
- **OT checklist estructurado vs blob de notas** — esperar señal de uso en campo
  (revisión "next quarter").

## 4. Rama `feat/asistente-ia` — pausada, con drift en prod

- 8 commits sin mergear (schema, panel `/asistente`, SSE, rate-limit, runbook).
- Sus 2 migraciones están aplicadas en prod: 4 tablas `agente_*`, vista `usuario_safe`,
  rol `agente_app` (mitigado a `NOLOGIN` el 2026-05-22). Drift inerte tolerado.
- ⚠️ Mientras exista el drift: **no correr `prisma migrate dev`** contra esa base
  (propondría dropear las tablas del asistente).
- **Decisión pendiente:** retomar la feature, mergear solo la capa de DB para limpiar el
  drift, o revertir. Hoy está en el limbo.

## 5. Docs desactualizados (corregidos / a corregir)

- `runbook-migraciones-pendientes.md` — decía que las 2 migraciones de WS-B estaban
  pendientes de deploy; `migrate status` confirma 23/23 aplicadas (entraron con el
  deploy de WS-C del 2026-05-22). **Corregido en esta revisión.**
- `phase9-plan.md` §WS-B — misma nota estale ("quedan pendientes de migrate deploy").
  **Corregido en esta revisión.**
- `roadmap-remaining.md` — sigue diciendo "Phase 8: prep done, awaiting manual QA".
  El cutover fue el 2026-05-21 y Fase 9 (WS A–E) está completa. Actualizar cuando se
  toque ese doc.

## 6. QA observations — abiertas (polish, baja urgencia)

Deuda de `qa-observations.md` que quedó para un "polish PR" post-cutover y nunca se hizo:

- **QA-038** — badge del sidebar de Inventario muestra un número que no matchea ningún
  KPI de la página (44 vs 5/268). Rastrear la query del badge. *(el más visible)*
- **QA-032** — tab "Facturas (próximamente)" en detalle de inventario: las facturas ya
  existen desde Fase 5; cablear la query o sacar el tab. + string hardcodeado.
- **QA-012** — eliminar tipo con instancias: opción deshabilitada sin explicación → toast.
- **QA-006** — ver §3 (decisión de producto).
- Sweeps cross-cutting: **QA-024/033** (`inputMode` en ~16 inputs numéricos),
  **QA-025** (truncate en columnas largas), **QA-027** (`Intl.NumberFormat` uniforme),
  **QA-029** (`<div onClick>` en action cells), **QA-031** (`autoFocus` en tablet),
  **QA-034** (date-fns → `Intl.DateTimeFormat`, sacar dep), **QA-035** (segunda pasada
  aria + screen-reader), **QA-028** (paginación server-side cuando crezcan las tablas).

Sugerencia: un único "polish PR" que agrupe QA-024/025/027/033 + QA-012 + QA-038, y
dejar QA-029/031/034/035 para cuando se toque cada área.

## 7. Backlog restante sin trigger (sin acción ahora)

- Mobile/tablet ergonomics (next quarter; Cervi usa tablets en chacra — subir prioridad
  si se quejan los operarios).
- Plantilla batch generator (trigger: decisión Vercel Cron vs botón admin; uso legacy
  casi nulo).
- WS-B3: guard `canAccessUp` en server actions de mutación (trigger: cuando se empiecen
  a asignar UPs en serio; hoy nadie tiene asignaciones).
- Filter bar + "Configurar KPIs" en `/estadisticas` (trigger: pedido de Cervi).
- Historial de transiciones de OT (confirmar alcance con Cervi).
- Multi-doc attachments por máquina; nivel reparenting (ticket-based); charts
  interactivos (Recharts); OC concurrentes (lock optimista); límites de Vercel Cron.
- Redesign R9 (sub-route polish): R1–R8 shippeados (`50e1433` y posteriores); los
  sub-routes de §6.1 del redesign-plan heredan tokens pero conservan layout viejo.

---

## Propuesta de "qué toca ahora" (orden sugerido, post-auditoría)

1. **Fix del stock en alta-Finalizado** (§1.1-1) — riesgo de datos activo: cada
   mantenimiento creado directo en Finalizado deja stock sin descontar.
2. **Branch Neon de dev + `.env.local` + seed guard** (§2.1-2.2) — elimina el mayor
   riesgo operativo; van juntos en un PR chico.
3. **Tanda de fixes de la auditoría** (§1.1-2 a 1.1-8) — notas en OC, precios
   pendientes de OT, scoping de mutaciones + movimientos diarios, drilldown por
   usuario, KPI Gastos, calendario por días, crear item desde OC. Agrupables en
   2–3 PRs por módulo.
4. **Error tracking** (§2.3) — medio día.
5. **Verificar PITR de Neon** (§2.4) — media hora de consola.
6. **Cargar TC** (§2.5) — form admin chico; verificar primero que el trigger se cumplió.
7. **Decidir con Cervi**: umbral de discrepancia, QA-006, y el caso de uso de cambiar
   proveedor en recepción (§1.1-9).
8. **Planificar** la normalización de enums (§2.8) como slice propio con QA de regresión.
9. **Decidir** el destino de `feat/asistente-ia` (§4).
10. **SMTP** (§2.6) — el trigger (34 usuarios > 15) ya se cumplió.
