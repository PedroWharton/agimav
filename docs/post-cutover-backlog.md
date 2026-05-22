# Post-cutover backlog

Open concerns deferred past Phase 8 cutover. Captured 2026-04-19 — before day-one QA. Re-triage after 30 days of production use.

Each item has a **When** field: `immediately` (first 30 days), `next quarter`, or `when triggered`.

## Product / UX

### SMTP + forgot-password flow
**When:** when triggered — user count passes ~15, or someone gets locked out and an invite re-issue isn't fast enough.
**Shape:** wire Resend/Postmark, add "olvidé mi contraseña" link on login, reuse invite-token table with a `purpose: reset` flag.
**Why deferred:** invite-link only works fine for 8 users.

### Mobile/tablet ergonomics
**When:** next quarter (or sooner if field operators complain).
**Shape:** audit form density, switch multi-column layouts to single-column under `md:`, verify tap targets ≥44px. Cervi uses tablets on chacra.
**Why deferred:** no touch testing during build; desktop-first ships.

### Multi-doc attachments per máquina
**When:** when triggered — Cervi asks again.
**Shape:** S3 / Neon blob storage + `MaquinaDocumento` table + upload UI on ficha.
**Why deferred:** not in legacy, raised verbally in walkthrough, not a launch blocker.

### Nivel reparenting (Phase 4 Slice C)
**When:** when triggered — admin files a ticket requesting the move.
**Shape:** currently admins edit via DB scripts. Full UI would need drag-drop with FK-safe cascade updates.
**Why deferred:** real-world frequency < 1x/month per Cervi; ticket-based is cheaper.

### OT task checklist structure
**When:** next quarter.
**Shape:** we modeled structured `mantenimiento_tareas` rows (checkbox + descripción + orden). Legacy uses a free-text blob.
**Why deferred:** waiting on Cervi field use to confirm if structured is right or users revert to notes blob.

## Tech debt baked in during builds

### `Mantenimiento.horasAcumuladas` snapshot column
**When:** ~~immediately (first 30 days)~~ — **shipped 2026-04-23** as commit `cd34f52`, pre-cutover.
**Shape:** added nullable `horas_acumuladas_snapshot` column, wrote snapshot in all 3 mantenimiento.create paths (manual form, plantilla aplicar, revisión programada child), and upgraded MTBF compute to prefer hour-based when every consecutive-pair of correctivos has snapshots.

### Estado string normalization + Prisma enum conversion
**When:** post-cutover, days 30–60 — treat as a scheduled data migration, not a casual edit.
**Shape:** three inconsistencies live in the data today:
- `Maquinaria.estado` is lowercase (`"activo"`).
- `Mantenimiento.estado`, `OrdenTrabajo.estado`, `OrdenCompra.estado`, `Requisicion.estado` are title-case with spaces (`"Pendiente"`, `"En Curso"`, `"Emitida"`, `"Parcialmente Recibida"`, `"En Reparación - Chacra"`, etc.).
- `Usuario.estado` is lowercase.
The string constants are now centralized (`lib/mantenimiento/estado.ts`, `lib/compras/oc-estado.ts`, `app/(app)/ordenes-trabajo/types.ts`) — `grep -n '"Pendiente"\|"En Curso"\|"Emitida"'` finds stragglers. Full migration requires:
1. Prisma schema: change `estado String` to a Prisma enum per model (e.g., `MantenimientoEstado`).
2. SQL migration: `UPDATE` to normalize casing (decide on canonical: all-lowercase-underscored is cleanest — `pendiente`, `en_reparacion_chacra`, `emitida`, `parcialmente_recibida`).
3. Update `scripts/migrate-from-sqlite.ts` to write the canonical form during the flota7.db import (otherwise the legacy strings return on the next migration-day re-run).
4. Update every callsite (helpers `isTerminal`, `isActivo`, etc., plus all query filters).
5. Full regression QA against a cloned prod branch before merging.
**Why deferred:** touches Compras/Mantenimiento/OT/Maquinaria/Estadísticas simultaneously; any missed callsite silently breaks a filter. Zero user-visible benefit today beyond code cleanliness. Doing it post-cutover means the SQLite→Postgres import runs first with legacy casing preserved, we validate the app works, *then* normalize — less coupled failure modes.
**Detected bug during 2026-04-23 review:** `loadBacklogPorMaquina` was filtering on `estado IN ("Pendiente", "En Proceso")` — but `"En Proceso"` is not a valid mantenimiento estado. Fixed in the same commit that centralized the constants. This is exactly the class of bug constants prevent.

### Evolución de precios — thin data
**When:** re-evaluate 90 days post-cutover (≈ 2026-07-19).
**Shape:** only 14 of 672 inventario items have ≥2 price points. If volume hasn't grown, consider demoting the view or merging into proveedor drilldown.
**Why deferred:** reports reveal usefulness over time, not at launch.

### `tabla_config` user-scoped entries not migrated cleanly
**When:** immediately — users reconfigure on first use post-cutover.
**Shape:** the migration preserves `tabla_config` rows but user-scoping to migrated usuarios may drift. Worst case: users rebuild column config in UI once.
**Why deferred:** rebuild is 30 seconds per user; building import logic would take a day.

### Hand-rolled SVG charts
**When:** when triggered — a chart needs tooltips/zoom/legend interactions.
**Shape:** `SparkLine`, `AbcPie`, `PriceChart`, `HorizontalBarChart` are all pure SVG. Swap to Recharts if interactivity demand grows.
**Why deferred:** static charts are faster to render and have zero dep surface.

### ~~Slice E (gasto por proveedor) will need a "gasto por usuario" companion~~ — ✅ SHIPPED (WS-E, 2026-05-22)
Resuelto por WS-E (`43bca93`): `/estadisticas/usuarios` combina gasto facturado (`Factura.usuario`) y actividad de pedidos (`Requisicion.solicitante`). El caveat de `usuario='Sistema'` en facturas legacy se muestra como nota en la pantalla; la métrica se llena con datos post-cutover.

## Phase 5 (Compras) — decisions still unresolved

### Invoice-vs-OC price discrepancy threshold
**When:** immediately — ask Cervi on first accounting walkthrough.
**Shape:** the `PriceDiscrepancyBadge` currently warns on any mismatch. Decide: exact match, ±1%, ±5%, or %-threshold configurable per proveedor?
**Why deferred:** needs Cervi domain input.

### Concurrent OC generation
**When:** when triggered — collision observed in logs.
**Shape:** two users clicking "Generar OCs" on the same requisición. Mitigate with optimistic lock on `Requisicion.updatedAt` or a state-check-inside-transaction guard.
**Why deferred:** Cervi has one procurement clerk; collision probability is low.

### "Cargar TC" admin UI (USD exchange-rate upload)
**When:** next quarter — low priority.
**Shape:** admin-only form to append rows to `DolarCotizacion` (`fecha` + `valor` ARS/USD). Legacy has a dedicated dialog to bulk-load rates (`Agimav23b.py` has the equivalent). Today the migrated 4 rows (Dec 2025 → Apr 2026) are the only data; new rates require a SQL insert. Once the last migrated rate ages out, `/estadisticas/precios` starts rendering the "aproximado" band for every recent point and the value of the view degrades.
**Why deferred:** recent rates still cover current queries; pain threshold is weeks/months away, not days. Flagged by parity audit 2026-04-19.

## Phase 6 (Mantenimiento) — decisions still unresolved

### Plantilla-de-mantenimiento trigger
**When:** next quarter.
**Shape:** currently the batch generator that turns active plantillas into pending mantenimientos is not wired. Decide: Vercel Cron (hobby plan has limits) vs manual admin button.
**Why deferred:** Cervi uses plantillas so rarely in legacy (~6 rows ever) that this isn't urgent.

## Phase 7 (Estadísticas) — UI scaffolded, not wired

### Filter bar on `/estadisticas` (date range / comparar / obra / categoría / granularidad)
**When:** next quarter — or earlier if Cervi asks to slice the dashboard by obra or wants a week/day view.
**Shape:** the home page has **no filter bar** today. The placeholder `StatsFilterBar` chip was deleted 2026-04-23 because it looked interactive but wasn't. Each card's subtitle states its own window ("últimos 90 días", "últimos 6 meses", "últimas 12 semanas"). To wire a real filter:
- **Date range picker:** add a URL-synced `RangeSelect` (or calendar popover) above the KPI strip, push selection as `?range=...` or `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`, and thread an optional `{ since?: Date }` into every `load*` function in `lib/stats/dashboard.ts`. Today they take `limit` / `months` / `weeks` / `topMachines` but no date range — the 90d / 6mo / 12w windows are computed inline. KPI strip stays snapshot (range is meaningless for "máquinas activas ahora").
- **Comparar con:** add an optional `compareRange` that returns a secondary set of KPIs; cards render trend delta from the comparison.
- **Obra filter:** scope every query to a specific `Obra.id`. Requires adding `obraId` joins across `Mantenimiento`, `OrdenTrabajo`, `OrdenCompra`, `Factura`. Cervi uses obras as the primary business axis, so this unlocks real drilldown.
- **Categoría filter:** scope to `Inventario.categoria` for spend/backlog charts.
- **Granularidad (Día/Semana/Mes):** currently hardcoded to monthly buckets in `loadTallerTrend` and `loadGastoPorRubro`. Switching to week/day means rewriting the SQL `date_trunc` expressions per query.
**Why deferred:** 2026-04-23 review explicitly chose to defer — touching 6+ loaders days before cutover risks regressions during QA that aren't worth it. Revisit once Cervi has a stable baseline and actually asks for a slice they can't currently get.

### "Configurar KPIs" button on `/estadisticas`
**When:** when triggered — once a second KPI-set emerges, or a Cervi user asks to hide cards they don't use.
**Shape:** admin-only dialog to toggle which KPI cards render in the strip (and, later, which rows in the 12-col grid). Persist per-user in a new `user_preferences` table or reuse `tabla_config`.
**Why deferred:** only 4 KPIs exist today and all are universally relevant; no demand signal yet.

## Phase 6 (Órdenes de Trabajo) — scope to revisit

### Historial de OT — dedicated per-OT state-transition log
**When:** when triggered — confirm scope with Cervi first.
**Shape:** a dedicated per-OT state-transition log. Today the OT listing shows the current estado only; state changes are implicit. Mantenimiento already has `MantenimientoHistorial` — OT could get an equivalent.
**Why deferred:** not in acceptance criteria, no day-one blocker.
**Note:** the sibling concern, "Movimiento Diario", was **shipped as WS-C C5** (`a649fb0`) — a standalone `/movimientos-diarios` module (cabecera + líneas, consumible/herramienta), not an OT-attached dialog.

## Ops / platform

### Error tracking
**When:** immediately (before T-0 if possible).
**Shape:** Sentry vs Highlight vs Axiom. Pick one, wire, route errors in server components + client. Budget: half a day.
**Why deferred:** decision kept being pushed.

### Neon backup cadence
**When:** immediately.
**Shape:** default Neon retention may not be enough. Verify point-in-time restore window is ≥7 days, consider scheduled logical dumps to object storage.
**Why deferred:** assumed defaults; not verified.

### `prisma/seed.ts` prod-safety guard
**When:** immediately — low effort.
**Shape:** seed currently creates `admin@cervi.local` / `cambiar123` unconditionally. Add a runtime guard that refuses to run if `DATABASE_URL` looks like prod (heuristic: hostname contains `prod`, or env var `ALLOW_SEED` not set).
**Why deferred:** documented in cutover-runbook as a known non-blocker but the guard itself is ~10 lines.

### Vercel Cron plan limits
**When:** when triggered — once plantillas scheduler is wired.
**Shape:** hobby plan caps daily invocations. If scheduling plantillas needs sub-daily runs, upgrade.
**Why deferred:** scheduler itself isn't wired yet.

### Base de desarrollo separada de producción
**When:** immediately — hoy cualquier trabajo de desarrollo corre contra la base de producción.
**Shape:** hay una sola base Neon (`neondb` en `ep-morning-bird-aejmvo5r…`); el `.env.local` del repo apunta ahí, así que dev = prod. Crear un branch Neon dedicado para desarrollo, apuntar `.env.local` a ese branch, y reservar la URL de prod solo para `migrate deploy` y la app desplegada en Vercel. Documentar cuál es cuál.
**Why deferred:** el cutover se hizo con una sola base. El riesgo se materializó el 2026-05-22: `prisma migrate status` reveló que la rama sin mergear `feat/asistente-ia` había aplicado 2 migraciones (`agente_ia_skeleton`, `agente_usuario_view`) directo a prod — 4 tablas `agente_*`, la vista `usuario_safe` y el rol `agente_app` con un password placeholder. Mitigado: el rol quedó `NOLOGIN` (2026-05-22). Las tablas/vista quedan como drift inerte en prod hasta que la rama se mergee o se revierta. Detalle y plan en `docs/runbook-migraciones-pendientes.md`.

### WS-B3 — scoping per-UP no cubre las server actions de mutación
**When:** cuando se empiece a asignar UPs a usuarios en serio (hoy nadie tiene asignaciones → nadie está acotado, así que no urge).
**Shape:** el scoping per-UP (`lib/up-scope.ts`) filtra los listados de Mantenimiento/OT y hace `notFound()` en sus páginas de detalle. Las server actions de mutación (`mantenimiento/actions.ts`, `ordenes-trabajo/actions.ts` — update, transiciones de estado, insumos) **no** revalidan el scope. Un usuario acotado no puede ver ni abrir un registro fuera de su scope desde la UI, pero una request cruda a una server action con un id ajeno no sería rechazada. Agregar un guard `canAccessUp` al inicio de esas actions.
**Why deferred:** el modelo de amenaza es 34 usuarios internos no hostiles; el guard de listado + detalle es proporcionado para v1, y WS-B3 in-scopeó explícitamente "los listados". Endurecer las actions es un paso aparte.

## Triage cadence

- **Every Monday** for 30 days post-cutover: re-read this file, promote `immediately` items off the backlog.
- **Day 30**: deep-review. Move stale items to `next quarter`, demote anything we've stopped caring about.
- **Day 90**: the Evolución-de-precios re-evaluation lands here.
- **Day 180**: the gasto-por-usuario revival lands here.
