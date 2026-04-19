# UX Spec 7 — Estadísticas

Scope: read-only dashboards that summarise what the operational modules (Inventario, Compras, Mantenimiento, OT, Maquinaria) produce. Five mergeable slices. Slice A is the load-bearing one — it's the first screen most users will open and the one the admin references during weekly reviews. The other four are focused lenses.

**Not in this spec:** write-side flows (we never mutate data here), forecasting or ML, per-chacra or per-UP dashboards (defer until Cervi explicitly asks — the operational modules already filter by UP), and any alerts/notifications pipeline (Slice A shows low-stock as a KPI but doesn't page anyone).

## 1. Purpose & users

Give Cervi a single place to answer the recurring management questions:

- **"Cómo estamos este mes?"** — monthly facturación total, OCs abiertas, bajo-stock count, mantenimientos pendientes. One screen, at-a-glance. Slice A.
- **"Qué ítems mueven plata?"** — ABC classification by consumption value, to focus stock-min tuning on the 20% that matters. Slice B.
- **"Cómo evolucionó el precio X de un repuesto?"** — price timeline in ARS + USD. Slice C.
- **"Qué máquinas nos están costando más?"** — MTBF + mantenimiento counts per máquina, ranked. Slice D.
- **"Con qué proveedor gastamos más?"** — gasto ranking by proveedor with monthly split. Slice E (swapped from the roadmap's "gasto por usuario" — see §2).

- **Primary actor:** `Administrador` — weekly review of the whole dashboard.
- **Secondary actor:** `Pañolero` (Inventario), `Responsable de taller` (Mantenimiento) — reach for Slice B and Slice D respectively.
- **Why it matters:** Phase 5 (Compras) and Phase 6 (Mantenimiento) are creating structured data that the legacy app never leveraged. This is where we pay that back.

## 2. Reality check — what the data actually looks like today

Probe on current Neon snapshot (2026-04-19, `scripts/estadisticas-probe.ts`):

| Thing | Count / Range |
|---|---|
| Máquinas | 236 (all `estado=Activo`) |
| Inventario | 672 ítems; 44 < stock mínimo |
| InventarioMovimiento salidas | 352 (308 mantenimiento · 34 OT · 10 mov_diario) |
| Ítems con ≥1 salida | 304 / 672 (~45%) |
| OCs abiertas | 4 / 114 totales |
| Facturas | 39 rows, 2025-12 → 2026-04, spend varies 10× (843k–14.5M ARS/mes) |
| PrecioHistorico | 116 rows, 90 ítems; **14 ítems con ≥2 puntos (graficables)** |
| DolarCotizacion | **4 filas** (2025-12 a 2026-04) |
| Mantenimientos | 127 correctivo · 2 preventivo |
| Máquinas con ≥2 correctivos (MTBF calc) | 31 / 236 (~13%) |
| Máquinas con ≥3 correctivos (MTBF robusto) | 8 / 236 (~3%) |
| Máquinas con 0 mantenimientos | 148 / 236 |
| Facturas.usuario distribución | **39/39 = "Sistema"** |

**Implications for the spec:**

1. **Slice A is green.** All card inputs are populated. Monthly trend has 5 data points — enough for a sparkline.
2. **Slice B ABC needs a fourth bucket.** 368 / 672 ítems have zero movement. Don't put them in class C — they drown out the real C tail. Classify only `items with ≥1 salida` as A/B/C and render the rest as "sin consumo" in a separate section.
3. **Slice C is sparse on purpose.** Only 14 / 672 ítems have ≥2 price points, and dolar rates only cover December 2025 onward. We still ship it because the value lands once Phase 5 is running for a quarter.
   - Default the item picker to items with ≥2 price points (order by most-recent-change first).
   - For dates before 2025-12, show ARS only with a "sin tipo de cambio — mostrando ARS" hint on the USD line.
   - **Flagged for revisit:** re-probe after 90 days of Phase 5 production use; if coverage is still <10% of ítems, reconsider whether this slice stays at /estadisticas or moves to a detail drawer off Inventario.
4. **Slice D ranking needs a min-mantenimientos filter.** Default to "≥2 mantenimientos" (31 filas); offer "≥3" and "todas" toggles. 148 zero-mant máquinas render as a separate "sin historial" footer count, not as rows with MTBF=∞.
5. **Slice E swap.** The roadmap originally spec'd "gasto por usuario"; all 39 legacy facturas are `usuario='Sistema'` so the chart reduces to one bar. Swap to **gasto por proveedor** for v1 — 57 unique suppliers in 114 OCs + 39 facturas is rich enough to rank, and it's the question Cervi actually asks during supplier reviews. Gasto-por-usuario becomes a post-cutover item once real users start creating facturas.
6. **Maquinaria.estado has no legacy variation** (all `Activo`). Don't build a "por estado" chart — it would render as a single bar.
7. **Preventivos are functionally absent** (2 rows). Slice D's correctivo-vs-preventivo split is a single-bar chart for now. Render both series but label the preventivo one as sparse.
8. **Date ranges are tiny.** The whole DB only has meaningful activity from ~2024-10 onward. Time-range defaults should be "todo" for this quarter; a "Últimos 30 días" default would often show one or zero rows.

## 3. Scope & shipping plan

Five mergeable slices. Each ships on its own PR.

### Slice A — KPI dashboard (PR #1, load-bearing)

- `/estadisticas` — home screen with KPI cards + monthly sparkline.
- Cards (5 tiles, responsive 2×3 on desktop, 1-col on mobile):
  - **Máquinas activas** — `Maquinaria` count where `estado='Activo'`. Delta vs last month (created minus retired — render as empty in v1 since we have no retirement data).
  - **Inventario bajo stock** — count of ítems where `stock < stock_minimo AND stock_minimo > 0`. Click → navigates to `/inventario?filter=bajoStock`.
  - **OCs abiertas** — count of `OrdenCompra` in `Emitida` or `Parcialmente Recibida`. Click → `/compras/oc?estado=abiertas`.
  - **Mantenimientos pendientes** — count in `Pendiente`. Click → `/mantenimiento?estado=Pendiente`.
  - **Facturación del mes (ARS)** — sum(`total`) over facturas in current month. Sparkline of last 12 months below the number.
- Time-range selector above the cards (`7d` · `30d` · `90d` · `ytd` · `todo`, default `90d`). Applies to the sparkline + monthly-spend card. Count cards stay "actual" (no range applies — they're snapshots).
- Admin-only row at the top for "OT en Curso" count (power-user quick link).

### Slice B — ABC de inventario (PR #2)

- `/estadisticas/abc` — table + pie chart.
- Windowed consumption: sum(`cantidad`) of `InventarioMovimiento.tipo='salida'` in selected range × `Inventario.valorUnitario` (current value, not historical) → consumption value.
- Sort desc by value, cumulative %, assign:
  - **A** = cumulative ≤ 80%
  - **B** = 80% < cumulative ≤ 95%
  - **C** = cumulative > 95%
  - **Sin consumo** (separate block) — ítems with 0 movements in the window.
- Columns: código, descripción, cantidad consumida, valor consumido, % del total, acumulado %, clase.
- Filter: time range (`30d` · `90d` · `ytd` · `all`, default `90d`).
- Export to Excel (reuse `exportToExcel` pattern from Inventario Slice D).
- Pie chart on the right shows A / B / C proportions (exclude "sin consumo" from the pie — note the count under the chart).

### Slice C — Evolución de precios USD (PR #3)

- `/estadisticas/precios` — item picker + dual-axis line chart.
- Item Combobox — **default options list = items with ≥2 PrecioHistorico rows** (ordered by most recent price-change date desc). Secondary tab "Todos los ítems" falls back to the full list.
- Once item picked:
  - Fetch all `PrecioHistorico` rows for that item joined with `DolarCotizacion` on the month of `fecha`.
  - Render two series on the same time axis: ARS (primary Y-axis, left) and USD (secondary Y-axis, right).
  - Points before the earliest `DolarCotizacion` row (2025-12) show only ARS, rendered with an annotation band labelled "sin tipo de cambio".
- Range filter: same time-range selector as Slice A.
- Proveedor filter: multi-select; default all. When filter active, show one line per proveedor (max 5, warn if more).
- Empty state: if the selected item has <2 rows, render "Este ítem solo tiene un punto de precio. No hay evolución para graficar."

**Data quality flag:** revisit slice relevance after Phase 5 has been live ~90 days. If coverage is still <10% of the catalog, consider demoting this from the dashboard to a drawer off `/inventario/[id]`.

### Slice D — MTBF + métricas por máquina (PR #4)

- `/estadisticas/maquinaria` — ranking table.
- One row per máquina. Columns:
  - **Máquina** (principal atributo from the structure-tree read pattern + nroSerie fallback)
  - **Tipo** (pill)
  - **Mantenimientos correctivos** (count in range)
  - **Mantenimientos preventivos** (count in range)
  - **MTBF (horas)** — requires ≥2 correctivos. Computed as:
    ```
    mean of (horasAcumuladas[n+1] - horasAcumuladas[n]) for consecutive correctivos.
    horasAcumuladas is snapshotted onto Mantenimiento.horasAcumuladas at creation.
    ```
    Fallback (legacy rows with no snapshot): use `(fecha[n+1] - fecha[n])` in days and label column accordingly.
  - **Horas operadas** — delta between first and last `RegistroHorasMaquinaria` in range. Render `—` if no registros.
  - **Costo total** (sum of OT insumos × valorUnitario + sum of Mantenimiento.costoReal (if present)).
- Filter: "≥2 mantenimientos" (default, 31 filas) · "≥3 mantenimientos" · "todas las máquinas" toggle. "Sin historial" count rendered as a footer chip.
- Sort: any column. Default = costo total desc.

**Open question (non-blocking):** does `Mantenimiento` carry a per-row `horasAcumuladas` snapshot today? Spec assumes we add a nullable column in Phase 6 retrospectively. If not present, ship with the date-based MTBF fallback and flag it as tech-debt for post-cutover.

### Slice E — Gasto por proveedor (PR #5, **swapped from roadmap**)

- `/estadisticas/proveedores` — ranking bar chart + table.
- Per proveedor: sum(`Factura.total`) in range, count of facturas, count of OCs (all states), promedio ARS / factura.
- Bar chart (horizontal, top 10 + "resto") by total ARS.
- Table with all proveedores, sortable by any column.
- Filter: time range (same selector as A/B/C).
- Export to Excel.
- Click on a proveedor row → drawer with the facturas list for that proveedor in the selected range (linkable to `/compras/facturas/[id]`).

**Deferred (post-cutover):** `gasto por usuario` — can't ship against legacy data where all facturas are `usuario='Sistema'`. Re-evaluate after 90 days of real-user write activity.

## 4. Schema touches (pre-build)

Nothing blocking. Everything needed exists from Phase 1.

**Optional audit column:**

- `Mantenimiento.horasAcumuladas` (Float?, `@map("horas_acumuladas_snapshot")`). Snapshot of the máquina's horómetro at the moment the mantenimiento was created. Enables hour-based MTBF in Slice D. **If we add it,** populate it only for new rows (legacy rows stay null, fall back to date-based MTBF). Ship this as part of Slice D, not Slice A.

**Index review:**

- `InventarioMovimiento(idItem, tipo, fecha)` — already covered by `@@index([idItem, fecha(sort: Desc)])`. Add `tipo` to the composite if EXPLAIN shows it scanning on ABC queries against large date ranges.
- `Factura(fechaFactura)` — add if monthly-spend queries get slow; skip for v1 (39 rows).
- `PrecioHistorico(itemId, fecha)` — already there via `@@index([itemId, proveedorId])` + `@@index([fecha])`. No new index.

**Backfill:** none.

## 5. Screens

Five surfaces. Wireframes show info density, not final polish.

### 5.1 Dashboard — `/estadisticas`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Estadísticas                                   [Últimos 90 días ▾]       │
│ Resumen operativo del mes y tendencias.                                  │
│ ──────────────────────────────────────────────────────────────────────── │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│ │ Máquinas     │  │ Bajo stock   │  │ OCs abiertas │                     │
│ │    236       │  │      44      │  │       4      │                     │
│ │ activas      │  │ de 672 ítems │  │ de 114 OCs   │                     │
│ └──────────────┘  └──────────────┘  └──────────────┘                     │
│ ┌──────────────┐  ┌────────────────────────────────┐                     │
│ │ Mant. pend.  │  │ Facturación del mes (ARS)      │                     │
│ │      12      │  │   $6.888.345                   │                     │
│ │              │  │   ▂▂▃▇▄▃▂▂▃▇▄▃ (12 meses)      │                     │
│ └──────────────┘  └────────────────────────────────┘                     │
│                                                                          │
│ ─ Admin ──────────────────────────────────────────────────────────────── │
│  OT en curso: 10                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 ABC — `/estadisticas/abc`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Volver                                                                 │
│ Análisis ABC                                   [90 días ▾] [Exportar]    │
│ Clasificación por valor consumido en el período.                         │
│ ──────────────────────────────────────────────────────────────────────── │
│ ┌─────────────────────────────┐     Distribución                         │
│ │ Cód │ Descripción │ Cant │ $ │     ┌──────┐                            │
│ │ A001│ Aceite 15W40│  120 │ …│     │ A 12%│  80% del valor             │
│ │ …                         │     │ B 23%│  15% del valor               │
│ └─────────────────────────────┘     │ C 65%│   5% del valor              │
│                                                                          │
│ Sin consumo en el período: 368 ítems                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Precios USD — `/estadisticas/precios`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Evolución de precios                    [Ítem ▾] [90 días ▾]             │
│ ──────────────────────────────────────────────────────────────────────── │
│                                                      ARS   USD            │
│  ▲  $800k                                             ●     ·             │
│     $600k          ●────●──────●                      ●     ·             │
│     $400k    ●────●                                                       │
│     $200k                                                                 │
│     $ 0                                                                   │
│      └──────────────────────────────────▶                                 │
│       2024-10                           2026-04                           │
│ ░░░░░░ sin tipo de cambio ░░░░│                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Maquinaria — `/estadisticas/maquinaria`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Métricas por máquina                     [≥2 mant. ▾] [90 días ▾]        │
│ ──────────────────────────────────────────────────────────────────────── │
│ Máquina        │ Tipo     │ Correct. │ Prev. │ MTBF   │ Costo ARS        │
│ John Deere 5090│ Tractor  │    5     │  0    │ 620 hs │ $345.000         │
│ Case Farmall   │ Tractor  │    3     │  0    │ 410 hs │ $189.000         │
│ …                                                                        │
│ Sin historial: 148 máquinas                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Proveedores — `/estadisticas/proveedores`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Gasto por proveedor                          [90 días ▾] [Exportar]      │
│ ──────────────────────────────────────────────────────────────────────── │
│ PAÑOL                  ████████████████████████ $12.340.000              │
│ Repuestos Industriales ██████████████ $7.210.000                         │
│ La Casa del Instalador █████████ $4.810.000                              │
│ …                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## 6. Components

- `KpiCard` — label, value, delta, optional sparkline. New shared component under `components/stats/`.
- `RangeSelect` — shadcn Select pre-wired with `7d` · `30d` · `90d` · `ytd` · `todo`. URL-synced via `useSearchParams`.
- `SparkLine` — minimal Recharts line, no axes, no legend. Used inside KpiCard.
- Recharts primitives: `LineChart` (Slice C), `BarChart` (Slice E), `PieChart` (Slice B).
- `ExportExcelButton` — reuse from Inventario Slice D.
- DataTable (TanStack) — reuse; only Slices B, D, E need it.
- `AbcBadge` — colored chip (use tokens: `bg-sky-500/10 text-sky-700` for A, `bg-amber-500/10 text-amber-700` for B, `bg-muted text-muted-foreground` for C). No raw hex.

## 7. Data layer

- All queries live in server components or server actions. No client-side aggregations.
- Prefer `prisma.$queryRaw<T>` for aggregations that need `date_trunc`, window functions, or cumulative %. Use generated Prisma queries for simple count / groupBy.
- Cap response sizes: top-50 row hard limit on ABC; top-100 on Slices D and E.
- Every page exports `const dynamic = "force-dynamic"` so the dashboard reflects live data. No ISR.

## 8. i18n keys (new namespace: `estadisticas.*`)

- `estadisticas.titulo`, `descripcion`
- `estadisticas.rangos.{7d,30d,90d,ytd,todo}`
- `estadisticas.kpi.{maquinas,bajoStock,ocsAbiertas,mantPendientes,facturacionMes,otEnCurso}`
- `estadisticas.abc.{titulo, clase.a, clase.b, clase.c, sinConsumo, cumulativo}`
- `estadisticas.precios.{titulo, placeholder, sinTipoCambio, sinDatosSuficientes}`
- `estadisticas.maquinaria.{titulo, filtro.min2, filtro.min3, filtro.todas, sinHistorial, mtbf.horas, mtbf.dias}`
- `estadisticas.proveedores.{titulo, topN, resto}`
- Shared: `estadisticas.exportar`, `estadisticas.vacio`, `estadisticas.cargando`

## 9. Edge cases per slice

**A:** Zero-row months (render the sparkline as a flat line with a tooltip "sin datos"). Negative delta on Máquinas Activas (don't show sign if delta=0).

**B:** Item with zero valorUnitario (exclude from ABC — it skews the cumulative). Same item appearing in multiple salidas with different costs (use current `Inventario.valorUnitario`, not per-movement).

**C:** Item with `precioArs=0` rows (filter before plotting). Proveedor filter with 6+ suppliers on one item (show first 5 + warning).

**D:** Máquina with 1 mantenimiento (hidden by default filter; appears when user toggles "todas"). Máquina with only preventivos and zero correctivos (MTBF column blank, not N/A).

**E:** Proveedor with only OCs but zero facturas (include with `total_facturas=0`; they still show up under "OCs abiertas" context).

## 10. Out of scope (v1)

- Forecasting / trend prediction.
- Per-chacra or per-UP dashboards (add once requested — filter infra is there).
- Real-time refresh (page reload is fine for v1).
- Drill-down charts with zoom / pan (Recharts default tooltip is enough).
- PDF export of the whole dashboard.
- Gasto por usuario (deferred — see §2 #5).

## 11. Acceptance checklist

Per slice:

- [ ] Typecheck + lint clean.
- [ ] i18n keys all in `messages/es.json`, no untranslated strings.
- [ ] Page renders on `/estadisticas/<slice>` without a session crash (auth redirect works).
- [ ] Uses brand token classes only (no raw hex).
- [ ] Query runs under 500ms against Neon dev data. Add index if not.
- [ ] Empty state renders on an empty table / zero-row filter.
- [ ] Exports (B, E) produce a valid .xlsx matching the visible table.

Cross-slice:

- [ ] Dashboard home links to all four sub-pages from a secondary nav.
- [ ] Time-range selector is URL-synced so bookmarks work.
- [ ] Stakeholder walkthrough with Cervi admin, especially Slice E swap.
