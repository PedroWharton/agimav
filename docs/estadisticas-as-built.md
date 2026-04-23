# `/estadisticas` — as-built reference

> Written 2026-04-23 for future AI agents. Updated same day after a review pass that fixed a handful of the divergences. Captures the **actual shipped state** of the estadísticas module, how it diverged from the spec, and where the pitfalls live. Read alongside — not instead of — [`ux-spec/7-estadisticas.md`](./ux-spec/7-estadisticas.md) (the spec is the "intent", this doc is the "reality").

## TL;DR

Five routes. Purpose: read-only management dashboards. All `force-dynamic`, all server-rendered, no client-side aggregation, no caching. The home dashboard (`/estadisticas`) expanded **well beyond the spec** (spec called for 5 KPI cards + a sparkline; today ships with 6 KPIs + 8 chart cards in a 12-col grid). The four sub-routes (`abc`, `precios`, `maquinaria`, `proveedores`) match the spec more closely, with one significant scope swap (Slice E became "gasto por proveedor" instead of "por usuario" because all legacy facturas carry `usuario='Sistema'`).

`/estadisticas/proveedores` is **admin-only** (see §7). Other routes require authentication only.

## 1. Route map

```
app/(app)/estadisticas/
  page.tsx                         # home dashboard (KPIs + 8 chart cards)
  abc/
    page.tsx                       # ABC classification table + donut
    actions.ts                     # computeAbc(), exportarAbc()
    abc-export-button.tsx          # client component, calls server action
    types.ts                       # AbcRange + shapes
  precios/
    page.tsx                       # price timeline per item (ARS + USD)
    actions.ts                     # getPriceSeries()
    item-picker.tsx                # client combobox, URL-synced
    types.ts
  maquinaria/
    page.tsx                       # ranking table + top-cost bar chart
    actions.ts                     # computeMaqMetrics()
    maquinaria-stats-client.tsx    # client table with sort/filter
    types.ts
  proveedores/
    page.tsx                       # gasto ranking + top-10 bar + table
    actions.ts                     # computeProveedoresGasto(), exportar...
    proveedores-export-button.tsx
    types.ts
```

Every `page.tsx` exports `const dynamic = "force-dynamic"`. Don't remove — live dashboards without caching is intentional.

Every `page.tsx` gates on `auth()` and redirects to `/login` if no session. `/estadisticas/proveedores` additionally requires `isAdmin(session)` — both on the page and defense-in-depth inside `actions.ts` (`computeProveedoresGasto` and `exportarProveedores` both call `requireAdmin`). The home page hides the "Gasto por proveedor" lentes tile when the viewer is not admin. Home-page OTIF and gasto-por-rubro charts are **not** admin-gated — they reveal proveedor names and category spend but no per-proveedor pesos.

## 2. Data layer

### Home dashboard → `lib/stats/dashboard.ts`

The home page calls **nine** loader functions in parallel:

| Loader | Shape returned | Source tables | Notes |
|---|---|---|---|
| `loadKpis()` | 6 KPIs (disponibilidad, bajoStock, ocsAbiertas, mantPendientes, otEnCurso, facturacionMes) + 12mo serie | `maquinaria`, `inventario`, `ordenes_compra`, `mantenimientos`, `ordenes_trabajo`, `facturas` | Mix of Prisma count + one $queryRaw (bajoStock) + one $queryRaw for monthly serie |
| `loadMezclaOt(limit=90d)` | donut slices per `tipo` | `mantenimientos` | groupBy(tipo); 90d hardcoded |
| `loadRepuestosConsumidos(n)` | top-N items by costo | `mantenimiento_insumos` + `inventario` | groupBy + lookup; 90d hardcoded |
| `loadBacklogPorMaquina(n)` | top-N máquinas by pending count | `mantenimientos` + `maquinaria` | estado in (Pendiente, En Proceso) |
| `loadOtifProveedores(n)` | top-N OTIF-ish % | `ordenes_compra` + `ordenes_compra_detalle` | $queryRaw; "completeness" leg only (no fechaPromesa in legacy) |
| `loadProductividadTecnicos(n)` | mantenimientos per user | `mantenimientos` + `usuarios` | groupBy(responsableId) |
| `loadTallerTrend()` | 12mo bars+line | `mantenimientos`, `facturas` | Two $queryRaw + JS merge |
| `loadGastoPorRubro(m, top)` | stacked bars, monthly × categoría | facturas → ... → inventario | 5-table JOIN chain; see §3 |
| `loadHorasParadaHeatmap(w, top)` | correctivo count per máquina × semana | `mantenimientos` + `maquinaria` | **Proxy**, not real horas parada |

All loaders are defensive — they return empty arrays / zeros instead of throwing, so the UI falls back to `InlineState`/`EmptyState` placeholders when legacy data is thin. The comment block at the top of `dashboard.ts` explicitly calls this out.

### Sub-routes → `<route>/actions.ts`

Each sub-route owns its own data-loading action. Range-to-gte logic lives in **`lib/stats/range.ts`** (shared helper, typed on `StatsRangeKey = "30d" | "90d" | "ytd" | "todo"`); each route's `RANGES` const is a subset of this, so passing a narrower union into the shared helper is safe.

Formatters (`formatCurrencyARS`, `formatCurrencyShort`, `formatNumber`, `formatMonthShort`, `formatMonthYear`) live in **`lib/stats/format.ts`**. Callers pass `fractionDigits` explicitly when they need non-default precision (e.g. precios uses `formatCurrencyARS(n, 2)` for the historial table).

### ABC — `abc/actions.ts`

Two `prisma.$queryRawUnsafe` queries (ranking + count of items with ≥1 salida). The ranking query `HAVING SUM(im.cantidad) > 0 AND COALESCE(i.valor_unitario, 0) > 0` already excludes zero-value items per the spec's edge case §9 B. Classification (A/B/C by cumulative %) happens in JS after the query, not in SQL. Thresholds hardcoded: A=80%, B=95%. No "sin consumo" bucket in the `rows` array — it's a separate `sinConsumo` count (inventario total − items with salidas).

### Precios — `precios/actions.ts`

`getPriceSeries(itemId, range)` fetches `PrecioHistorico` + all `DolarCotizacion` rows, builds a `Map<'YYYY-MM', tc>`, then per-point divides ARS by the TC for that month. Points before the earliest cotización row return `precioUsd: null` — the chart's `dolarFrom` prop tells `PriceChart` where to shade the "sin tipo de cambio" band.

**`loadItemOptions()`** (in `precios/page.tsx`, not `actions.ts`) picks which items the combobox shows. Sorted by `graficable` (≥2 rows) first, then alphabetically. Default `effectiveItemId` = first graficable item. Only items with `precioArs > 0` in `PrecioHistorico` are eligible.

### Maquinaria — `maquinaria/actions.ts`

Five sequential loads + an in-memory join:
1. All `maquinaria` rows with `tipo`.
2. `principalMap` via $queryRaw (walks `maquina_nodos` + `maquina_atributos_valores` + `nivel_atributos` where `es_principal=true`). This is how the "Máquina" column gets a human-readable label — it pulls the principal atributo from the structure tree. **If legacy atributos change, this query changes too.**
3. All `mantenimientos` in range (ordered by `fechaCreacion` asc so MTBF windowing works).
4. `mantenimientoInsumo.groupBy({ by: mantenimientoId })` for cost per mantenimiento.
5. All `registroHorasMaquinaria` in range (for `horasOperadas` = last − first).

**MTBF is date-based, not hours-based.** Spec §4 flagged this as optional but said "add `Mantenimiento.horasAcumuladas` in Slice D." It wasn't added. The `Mantenimiento` model still has no `horasAcumuladas` column. The backlog item "`Mantenimiento.horasAcumuladas` snapshot column" (When: **immediately, first 30 days**) is the fix.

Sort is always `costoTotal desc` server-side. The client (`maquinaria-stats-client.tsx`) re-sorts/filters in-browser.

### Proveedores — `proveedores/actions.ts`

Single `factura.groupBy({ by: proveedorId })` + proveedor name lookup. `porcentaje` computed in JS. Empty query returns `{ rows: [], totalGeneral: 0, ... }` — the page renders an empty state.

**Important:** This only counts `facturas`, not OCs. The spec said the table should include "count of OCs (all states)" — that column **does not exist** in the shipped table. The spec said clicking a proveedor opens a drawer with facturas — **no drawer exists**. The table is a plain ranking only.

## 3. The 5-table JOIN in `loadGastoPorRubro`

```
facturas
  ↓ factura_detalle.factura_id
factura_detalle
  ↓ recepciones_detalle.id = factura_detalle.recepcion_detalle_id
recepciones_detalle
  ↓ ordenes_compra_detalle.id = recepciones_detalle.oc_detalle_id
ordenes_compra_detalle
  ↓ requisiciones_detalle.id = ordenes_compra_detalle.requisicion_detalle_id
requisiciones_detalle
  ↓ inventario.id = requisiciones_detalle.item_id
inventario.categoria
```

This is the only chart today that crosses all five Phase 5 (Compras) tables. If any of those FK columns are renamed, this query silently returns zero rows (the chart renders "sin datos" instead of erroring). Categorías with null/empty names are bucketed as "Otros" in SQL (`COALESCE(NULLIF(TRIM(categoria), ''), 'Otros')`), and overflow categorías past `topCategorias` (default 3) also roll into "Otros" in JS.

## 4. Charts

All charts are **hand-rolled SVG** in `components/stats/`. Recharts was deferred (backlog item "Hand-rolled SVG charts" — When: *when triggered*). The components:

| Component | Shape | Used by |
|---|---|---|
| `KpiCard` | label + value + caption + optional icon/tone/href/sparkline | home + every sub-route |
| `SparkLine` | inline 12-pt svg line | inside KpiCard (where passed) |
| `Donut` | slices with tone; optional centerLabel | home mezcla, abc distribution |
| `HorizontalBars` | rows with label/value/tone; optional objective line | home backlog/otif/tecnicos, maquinaria top-costo, proveedores top-10 |
| `StackedBars` | monthly × segmentKey | home gastoRubro |
| `Heatmap` | rows × cols × value cells; color via `color-mix(... danger ...%)` | home horas parada |
| `PriceChart` | dual-axis ARS/USD line + "sin tipo de cambio" band | precios |
| `AbcBadge` | A/B/C chip | abc table cells |
| `ChartCard` | card shell w/ title/subtitle + optional link | every chart on home + sub-routes |
| `RangeSelect<T>` | URL-synced shadcn Select | all four sub-routes |

`TallerTrendCard` inlines its own SVG instead of using one of the shared components (dual-axis bars+line). Don't extract it unless you hit a second dual-axis need.

## 5. Tokens & styling

Strictly brand tokens. Colors come from CSS variables defined in Tailwind v4:
- `--brand` → sky (primary)
- `--info`, `--success`, `--warn`, `--danger` → semantic tones
- `--muted-foreground`, `--foreground`, `--border`, `--card`

Chart palettes pick from these via `var(--brand)`, `var(--info)`, etc. The heatmap uses `color-mix(in oklch, var(--danger) X%, var(--card))` for gradient intensity. **Never introduce raw hex** — it's called out in `AGENTS.md` as a non-negotiable.

## 6. There is no filter bar on home

The home page ships with **no interactive time-range control**. Each chart carries its own hardcoded window, communicated in the card subtitle ("últimos 90 días", "últimos 6 meses", "últimas 12 semanas", etc.). The PageHeader description is just `t("dashboard.subtitulo")` — no period claim.

The original intent (date range picker + comparar + obra + categoría + granularidad) is still in the backlog: "Filter bar on `/estadisticas`" (When: *next quarter*). An earlier `StatsFilterBar` component rendered a chip that looked interactive but wasn't — it was deleted on 2026-04-23 because it misled users into trying to click it.

**When wiring real filters, the refactor surface is:** every `load*` function in `lib/stats/dashboard.ts` currently takes either zero args or a `limit` / `months` / `weeks` / `topMachines` number. None accept date ranges. Every one has its window hardcoded as `daysAgo(90)` or `twelveAgoStart` / `months` computed inline. Threading an optional `{ desde, hasta }` through all nine loaders is a one-commit refactor but not small.

## 7. Divergences from spec — the surprising ones

| Topic | Spec said | Shipped |
|---|---|---|
| Home dashboard | 5 KPI cards + sparkline | **6 KPIs** (Disponibilidad / Bajo stock / OCs abiertas / Mant. pend. / OT en curso / Facturación mes) + **sparkline on Facturación card** + 8 chart cards |
| "Disponibilidad %" card | Not in spec | **Added.** `activas / total`. |
| Time-range selector above cards | URL-synced `7d/30d/90d/ytd/todo` | **Not wired** on home (only sub-routes have it). No filter bar at all. |
| Range default | 90d | Per-chart hardcoded (90d / 6mo / 12 weeks / 12mo depending on card), not read from URL |
| Slice B (ABC) filter range | 30d/90d/ytd/all | 30d/90d/ytd/**todo** (label rename, same semantics) |
| Slice B empty-state: `valorUnitario=0` items | "exclude" | Excluded in SQL via `HAVING ... valor_unitario > 0` |
| Slice C (Precios) proveedor filter | Multi-select, max 5 | **Not implemented** — the picker only selects an item |
| Slice D MTBF | Hour-based if `Mantenimiento.horasAcumuladas` present, else date fallback | Always date-based (column never added). UI is honest — column header says "MTBF (días)" and page subtitle says "estimado por fechas". |
| Slice D "≥2 / ≥3 / todas" filter | Server-side default `≥2` | Server returns **all rows**; client component handles filter |
| Slice E admin gate | Spec implicit (Administrador primary actor) | **Enforced**: `isAdmin` check on page + `requireAdmin` on actions |
| Slice E columns | proveedor / facturas / OCs / total / promedio | proveedor / facturas / total / % / última (no OC count, no promedio) |
| Slice E drilldown | Click → facturas drawer | **Not implemented** |

These are tech-debt, not bugs. Ship-as-built was the right call for cutover-on-time. Catch them during post-cutover triage.

## 8. i18n

Everything user-facing keys into `estadisticas.*` under `messages/es.json` (the file has ~1915 lines; estadisticas is a big chunk of it). Sub-namespaces:
- `estadisticas.titulo`, `descripcion`
- `estadisticas.rangos.{30d,90d,ytd,todo}` (7d not used; spec called for it)
- `estadisticas.dashboard.*` (home-specific, includes all chart card titles/subtitles)
- `estadisticas.abc.*`, `estadisticas.precios.*`, `estadisticas.maquinaria.*`, `estadisticas.proveedores.*`
- `estadisticas.filtros.*` (for the fake filter bar chip)
- `estadisticas.lentes.*` (the sub-route cards at the bottom of home)

When adding a chart, always add keys under `estadisticas.dashboard.<chartName>.*` — titulo, subtitulo, and any legend/ratio/caption strings. The existing loaders assume the translator won't miss keys.

## 9. Performance

- Home page = 9 parallel loaders. Probe numbers (2026-04-19): `facturas=39`, `mantenimientos=~130`, `inventario=672`, `ordenes_compra=114`. Fast enough that no query has an index rec other than what Phase 1 already shipped.
- Each sub-route runs ≤5 queries. The 5-table JOIN in `loadGastoPorRubro` is the slowest; still sub-second on current Neon branch.
- If any query starts scanning post-cutover (more facturas, more mantenimientos), revisit `Factura(fechaFactura)` and `InventarioMovimiento(idItem, tipo, fecha)` indexes — spec §4 flagged both.

## 10. Gotchas for a future agent

1. **Don't re-introduce a placeholder filter bar.** A fake `StatsFilterBar` chip was shipped and then removed for misleading users. Wire real filters only if the user explicitly in-scopes the backlog item — it's a multi-function refactor across `lib/stats/dashboard.ts`, not a 20-line PR.
2. **Don't add user-scoped spend charts.** All 39 legacy facturas have `usuario='Sistema'`. The backlog tracks the revival for ~2026-10-19 once real users accrue facturas. If you build it against current data, the chart is one bar labeled "Sistema".
3. **Don't remove `force-dynamic`.** The admin relies on the dashboard reflecting changes from ≤1 minute ago.
4. **Don't add caching (`revalidate`, `unstable_cache`).** Same reason.
5. **MTBF date-based fallback is hiding in Slice D.** UI labels are honest (column says "MTBF (días)", subtitle says "estimado por fechas"), but the underlying `horasAcumuladas` column still isn't on `Mantenimiento`. If you're adding anything to Phase 6 that looks like it could snapshot `horasAcumuladas`, do it — the backlog item is a 30-day promise.
6. **Raw SQL in `loadGastoPorRubro` joins `requisiciones_detalle.item_id` → `inventario.id` via INNER JOIN.** If `requisiciones_detalle` ever gets a free-text item (non-FK), this chart silently drops those facturas. Either LEFT JOIN + `COALESCE('Sin categoría')` or document the assumption before refactoring.
7. **"OT en Curso" KPI uses `estado="En Curso"`** (literal string match with space and capital E). Case-sensitive. Don't "normalize" these without checking the enum in the Prisma schema — the legacy data carries the exact strings.
8. **`loadKpis()` uses `estado: "activo"` (lowercase)** for máquinas, but `"Pendiente"` (capital P) for mantenimientos, `"En Curso"` (capital) for OTs, and `["Emitida", "Parcialmente Recibida"]` (title-case) for OCs. These capitalizations come from legacy data and are **not consistent**. Grep before mutating.
9. **Principal-atributo query** in `maquinaria/actions.ts` assumes exactly one `es_principal=true` atributo per máquina at the root node. If multi-root máquinas ever exist, the `principalMap` silently keeps only one.
10. **RBAC: `/estadisticas/proveedores` is admin-only**, gated both on the page (`isAdmin(session)` + redirect) and inside actions (`requireAdmin`). The home lentes tile is hidden for non-admins. If you add another commercially-sensitive view, follow the same double-gate pattern — don't rely on UI-only hiding.
11. **Shared helpers live in `lib/stats/format.ts` and `lib/stats/range.ts`.** Don't re-add local copies per route. If you need a new formatter, add it to `format.ts`.
12. **Spec-first rule still applies.** If you extend `/estadisticas`, either update `ux-spec/7-estadisticas.md` or update this doc. The two together are the source of truth; don't let them drift further.

## 11. Manual QA status

Per memory `phase7_manual_qa_pending.md`: all 5 slices shipped 2026-04-19, end-to-end browser walkthrough **still outstanding** before cutover. If you are about to change this module, assume the current shipped state has not been exercised in a browser yet — add manual-QA notes for whatever you change.
