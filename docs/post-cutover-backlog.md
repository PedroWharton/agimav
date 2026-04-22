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
**When:** immediately (first 30 days).
**Shape:** add column, backfill on `fechaInicio` close via `RegistroHorasMaquinaria`, switch Slice D MTBF from date-based to hours-based (matches legacy semantics).
**Why deferred:** spec called for it, Phase 6 shipped without it to stay on budget.

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

### Slice E (gasto por proveedor) will need a "gasto por usuario" companion
**When:** 6 months post-cutover (≈ 2026-10-19).
**Shape:** legacy facturas all carry `usuario='Sistema'`, so user-attribution was impossible. Going forward, new facturas will write real usuarios — the original "gasto por usuario" report becomes viable once enough data accrues.
**Why deferred:** dead-on-arrival with current data.

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
**Shape:** `components/stats/stats-filter-bar.tsx` ships today as a **visual shell** — all controls are `aria-disabled` with "Próximamente" tooltips. To wire:
- **Date range picker:** replace the pill with a calendar popover; push the selected range as search params (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`) and thread through every `loadKpis` / `loadMezclaOt` / … function in `lib/stats/dashboard.ts` (they currently take no args — all hardcoded to 90d).
- **Comparar con:** same — add an optional `compareRange` that returns a secondary set of KPIs; KPI cards render trend delta from the comparison.
- **Obra filter:** scope every query to a specific `Obra.id`. Requires adding `obraId` joins across `Mantenimiento`, `OrdenTrabajo`, `OrdenCompra`, `Factura`. Cervi uses obras as the primary business axis, so this unlocks real drilldown.
- **Categoría filter:** scope to `Inventario.categoria` for spend/backlog charts.
- **Granularidad (Día/Semana/Mes):** currently hardcoded to monthly buckets in `loadTallerTrend` and `loadGastoPorRubro`. Switching to week/day means rewriting the SQL date_trunc expressions per query.
**Why deferred:** the dashboard ships with a fixed 90-day window that covers the cutover QA need. Wiring filters is a multi-function refactor that isn't a launch blocker. Typography + layout match the design today; the interactions can land iteratively post-cutover.

### "Configurar KPIs" button on `/estadisticas`
**When:** when triggered — once a second KPI-set emerges, or a Cervi user asks to hide cards they don't use.
**Shape:** admin-only dialog to toggle which KPI cards render in the strip (and, later, which rows in the 12-col grid). Persist per-user in a new `user_preferences` table or reuse `tabla_config`.
**Why deferred:** only 4 KPIs exist today and all are universally relevant; no demand signal yet.

## Phase 6 (Órdenes de Trabajo) — scope to revisit

### OT "Movimiento Diario" + dedicated historial view
**When:** when triggered — confirm scope with Cervi first.
**Shape:** parity audit 2026-04-19 flagged two legacy OT entry points with no web equivalent:
- **"Movimiento Diario"** (`Agimav23b.py` ~line 20225) — opens a dialog to record daily-activity justifications per OT. Purpose unclear from code alone: could be time-tracking, could be a free-text journal, could be a duplicate of OT `descripcion` updates.
- **Historial de OT** — a dedicated per-OT state-transition log. Today the listing shows current estado only; state changes are implicit.
**Why deferred:** not in acceptance criteria, no day-one blocker, scope requires Cervi input before we commit to UI. If "Movimiento Diario" turns out to be just a notes blob, it may collapse into the existing OT detail form instead of a new surface.
**How to apply:** before building, schedule 10 min with Cervi to demo the legacy button and capture what they actually use it for. Log the finding here before implementing.

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

## Triage cadence

- **Every Monday** for 30 days post-cutover: re-read this file, promote `immediately` items off the backlog.
- **Day 30**: deep-review. Move stale items to `next quarter`, demote anything we've stopped caring about.
- **Day 90**: the Evolución-de-precios re-evaluation lands here.
- **Day 180**: the gasto-por-usuario revival lands here.
