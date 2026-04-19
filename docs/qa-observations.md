# QA observations — pre-cutover walkthrough

Findings from the manual QA pass against the Neon dev DB (parity-verified vs `flota7.db` on 2026-04-19). One row per finding; resolve before cutover unless explicitly deferred to `post-cutover-backlog.md`.

**Severity scale**

- `blocker` — cutover-blocking; must fix before T-0.
- `high` — broken functionality or correctness bug; fix before cutover.
- `medium` — UX friction or missing feature that hurts daily use; fix before cutover if cheap, otherwise backlog.
- `low` — cosmetic or future-facing; safe to defer post-cutover.

**Status:** `open` → `in progress` → `fixed` (with commit) → `deferred` (with backlog pointer).

---

## QA-001 · Mantenimiento estado filter excludes finalizados unless toggle is on

- **Module:** Mantenimiento (Phase 6, Slice A)
- **Severity:** medium
- **Status:** **fixed (committed, ae6d778)**
- **Repro:** `/mantenimiento`, set Estado filter to "Finalizado". Result: empty list. Must additionally tick "Incluir finalizados / cancelados" for rows to render.
- **Fix:** gated the terminal-exclusion check on `estadoFilter === ALL`. When the user explicitly picks any estado (terminal or not), the estado selector is authoritative and the "incluir cerrados" toggle is ignored. The toggle still governs the default "all estados" view.

## QA-002 · Mantenimiento list has no pagination

- **Module:** Mantenimiento (Phase 6, Slice A)
- **Severity:** medium
- **Status:** open
- **Context:** legacy has 129 mantenimientos. Spec §2.1 said "TanStack server-side at 50/page covers everything with room" — that doesn't appear to be wired.
- **Risk:** post-cutover the table grows without a ceiling; perf and UX both degrade.
- **Proposed fix:** add server-side pagination (50/page) per spec. Apply same treatment to `/ordenes-trabajo` and `/mantenimiento/horometros` if they have the same gap.

## QA-003 · Pages not responsive on mobile/tablet

- **Module:** Cross-cutting
- **Severity:** low
- **Status:** deferred → post-cutover-backlog "Mobile/tablet ergonomics"
- **Notes:** Cervi uses tablets on chacra per backlog. Already captured as `next quarter` work. No new action — flagged here to confirm it surfaced during QA.

## QA-004 · Runtime error on `/mantenimiento/plantillas/[id]` — invalid `"use server"` exports

- **Module:** Mantenimiento (Phase 6, Slice B) + cross-cutting
- **Severity:** **blocker**
- **Status:** **fixed (uncommitted)**
- **Symptom:** opening `/mantenimiento/plantillas/1` throws `A "use server" file can only export async functions, found object` (Next 16 strict mode), originating from `app/(app)/mantenimiento/plantillas/actions.ts` re-exported via `lib/mantenimiento/estado.ts`.
- **Root cause:** Next 16 forbids `"use server"` files from exporting anything other than async functions. We exported const arrays (`FRECUENCIA_UNIDADES`), TS types (`FrecuenciaUnidad`, `*ActionResult`), and sync helpers (`rangeToGte`, `otIsActiva`, `otIsTerminal`).
- **Fix:** systemic sweep — extracted every non-async export from 27 `"use server"` files into sibling `types.ts` files. Convention: one `types.ts` per actions file, even when it holds const arrays / sync helpers in addition to types. ~17 consumer files updated to import from `./types` instead of `./actions`. Verified `npm run typecheck`, `npm run lint`, `npm run build` all pass; the previously-failing routes compile cleanly.
- **Dropped along the way:** `export { ESTADOS_REQ, PRIORIDADES }` re-export in `compras/requisiciones/actions.ts` was unused outside the file (and `ESTADOS_REQ` itself was a dead local). Removed.

## QA-005 · Buttons missing `cursor: pointer`

- **Module:** Cross-cutting (UI primitives)
- **Severity:** low
- **Status:** **fixed (uncommitted)**
- **Notes:** Tailwind v4 / shadcn defaults: native `<button>` doesn't ship `cursor-pointer`. Added `cursor-pointer` to the base `Button` variant in `components/ui/button.tsx`; propagates everywhere via the shared cva base.

## QA-006 · Adding an insumo on a mantenimiento doesn't write a historial row

- **Module:** Mantenimiento (Phase 6, Slice A)
- **Severity:** high
- **Status:** open
- **Repro:** open a non-terminal mantenimiento, add an insumo via the editor, save. Historial timeline shows no new row.
- **Spec reference:** §4.2 — "insumo added/edited/removed at finalización" writes `tipo_cambio='insumo'`. Reading §4.1 + §4.2 together, **historial-on-add was scoped to finalización only** in the spec. This may be working as designed.
- **Question for product:** should adding an insumo **before** finalización also write historial? Pro: full audit. Con: historial noise (spec §11 already worried about chattiness). Decide before cutover.

## QA-007 · Insumos editor requires horizontal scroll to reach quantity column

- **Module:** Mantenimiento (Phase 6, Slice A — shared `InsumosEditor`)
- **Severity:** medium
- **Status:** **fixed (uncommitted)**
- **Repro:** open a mantenimiento detail, scroll the insumos table — quantity column is offscreen on standard desktop widths (detail has a 340px sidebar + 24px gap + body padding, so the main column is ~860px on a 1280 laptop).
- **Fix:** folded `costoUnitario` into the `cantidadUtilizada` cell as a small `@ $X.XX` caption next to the unit — removes a whole column. Downsized `cantidadSugerida` from a disabled Input to plain text and shrank its column from `w-24` to `w-20`. Net: ~52px saved, no horizontal scroll at laptop widths; total still in its own column as the primary number.
- **Not touched:** OT inline editor (`ordenes-trabajo/[id]/ot-detail-client.tsx`) uses its own editor with different shape — track separately if it regresses.

## QA-008 · Build error on `/estadisticas/abc` — invalid `"use server"` exports

- **Module:** Estadísticas (Phase 7, Slice B)
- **Severity:** **blocker**
- **Status:** **fixed (uncommitted)** — folded into QA-004 systemic refactor.

---

## QA-011 · Insumos editor accepts blank-item lines on save

- **Module:** Mantenimiento (Slice A — shared `InsumosEditor`) + OT (Slice D — inline editor)
- **Severity:** medium
- **Status:** **fixed (committed, f9e7581)**
- **Repro:** open an OT or mantenimiento detail → "Agregar línea" in the insumos editor → leave the Item combobox empty → save. Before fix: line was silently dropped.
- **Fix:** each blank line now shows an inline `text-destructive` hint ("Seleccioná un ítem o eliminá la línea") and the save handler aborts with a toast instead of filtering rows out. `handleSaveInsumos` (mantenimiento) and `saveInsumos` (OT) both block; users see which rows need attention.
- **Not in scope:** plantilla form still silently filters blank-item insumos (used for drafts while composing a plantilla — arguably OK, logging separately if it becomes a complaint). Compras detail editors (requisición/recepción/factura líneas) don't share this shape and were not touched.

## QA-010 · Horómetro create form: date field has no default

- **Module:** Mantenimiento (Phase 6, Slice C)
- **Severity:** low
- **Status:** **fixed (committed, 149d587)** — `fechaRegistro` state now initialises with a local `todayISODate()` helper matching the factura/recepción precedent; `resetForm()` also restores today so reopening the dialog re-defaults. Server already fell back to `new Date()` when the field was empty, so server behavior is unchanged.
- **Repro:** `/mantenimiento/horometros` → "Nuevo registro" → date picker is empty.
- **Why this is wrong:** the common case is "I'm logging today's horometer reading." Forcing the user to pick a date every time obscures that they could leave it alone for the typical case.
- **Proposed fix:** default the date input to today (`new Date().toISOString().slice(0, 10)`). Users overrride only when back-filling.

## QA-009 · Plantilla "aplicar a máquina" dropdown empty + casing inconsistency in `Maquinaria.estado`

- **Module:** Mantenimiento (Phase 6, Slice B) + cross-cutting
- **Severity:** **blocker** (silent data hiding)
- **Status:** **fixed (uncommitted)**
- **Symptom:** opening `/mantenimiento/plantillas/[id]` shows an empty máquina dropdown for the Abonadora plantilla even though 1 Abonadora exists.
- **Root cause:** `Maquinaria.estado` schema default was `"Activo"` (capital A) and all 236 legacy rows + 1 dev row stored it that way, while every other entity in the schema (`Usuario`, `Proveedor`, `MaquinariaTipo`) consistently uses lowercase `"activo"`. Three queries filtered Maquinaria by lowercase `"activo"` and silently returned zero rows. Two other reads in `/estadisticas` queried capitalized `"Activo"` and worked but reinforced the inconsistency.
- **Fix (Option B — full normalization):**
  - Schema default `Maquinaria.estado @default("activo")`.
  - New migration `20260419171605_lowercase_maquinaria_estado` runs `UPDATE "maquinaria" SET estado = LOWER(estado)` then resets the column default. Picks up the unrelated `inventario.updated_at DROP DEFAULT` drift Prisma noticed; benign because `@updatedAt` is set at the app layer.
  - `scripts/migrate-from-sqlite.ts` lowercases `estado` on import (idempotent re-runs stay normalized; Cervi's flota7 still stores `"Activo"`).
  - `app/(app)/maquinaria/[tipoId]/maquinaria-client.tsx` form picker SelectItem values + create-default lowercased; display labels stay capitalized.
  - `app/(app)/estadisticas/page.tsx` + `scripts/estadisticas-probe.ts` swapped to lowercase filter.
  - The 3 originally-broken queries (`mantenimiento/nuevo`, `mantenimiento/horometros`, `mantenimiento/plantillas/[id]`) need no code change — they were already lowercase; data normalization makes them work.
- **Verified:** parity-check (9 diffs all Postgres-has-more from QA-time additions, no losses), typecheck, build all green. 237 maquinaria rows confirmed lowercase post-migration.

## QA-012 · Maquinaria tipos: delete option disabled (not toast-blocked) when tipo has instances

- **Module:** Maquinaria (Phase 4, tipos listing)
- **Severity:** low
- **Status:** open
- **Repro:** `/maquinaria/tipos` → row menu on a tipo with `instanciasCount > 0` → "Eliminar" option is disabled (greyed out).
- **Spec/test plan said:** "Try deleting an existing tipo with instances — should be blocked with an error toast."
- **Why this is a (small) gap:** disabled-without-explanation hides the *reason* (FK in use). A toast would say "no se puede eliminar: hay N máquinas en uso", which is more discoverable.
- **Proposed fix:** keep menu item enabled, route through the delete confirm dialog, and let the server return `{ ok: false, error: "in_use", count }` → toast. Or: add a tooltip on hover of the disabled item explaining why.

## QA-013 · Column config save fails — Prisma transaction timeout (5000 ms)

- **Module:** Maquinaria (Phase 4, `/maquinaria/[tipoId]` column drawer)
- **Severity:** **blocker** (admin can't customise columns)
- **Status:** **fixed (uncommitted)**
- **Symptom:** clicking "Guardar" in the column config drawer for a tipo with ~25 columns returns the generic "errorGuardar" toast.
- **Root cause:** `saveColumnConfig` did `deleteMany` + a sequential `for` loop of `tx.tablaConfig.create()` (one round-trip per column). 25 round-trips against Neon overran Prisma's default 5000 ms interactive-transaction timeout (`A query cannot be executed on an expired transaction. ... 5405 ms passed`).
- **Fix:** swapped the loop for a single `tx.tablaConfig.createMany({ data: rows })` — one round-trip instead of N. Also added `console.error` in the catch so future failures surface in the dev terminal instead of being swallowed.
- **Related (not fixed):** other actions also have `for (...) tx.X.create(...)` loops inside transactions (`compras/facturas`, `compras/recepciones`, `compras/requisiciones/[id]/asignar`, `ordenes-trabajo`, `mantenimiento`). They interleave reads + updates per iteration so `createMany` doesn't drop in cleanly, but they share the same 5 s ceiling. Real-world line counts are small (≤10), so likely safe — flag only if QA trips one. Long-term: bump `$transaction(..., { timeout: 15000 })` selectively, or restructure to bulk operations.

## QA-014 · Duplicate column when `es_principal` + an explicit principal-atributo entry are both visible

- **Module:** Maquinaria (Phase 4, `/maquinaria/[tipoId]` table)
- **Severity:** **blocker** (React duplicate-key warning, principal column rendered twice, sorting/cells inconsistent)
- **Status:** **fixed (uncommitted)**
- **Symptom:** after persisting a column config that has `es_principal=visible` AND an `attribute` entry whose id matches a principal atributo, the table renders the same `attr_<id>` column twice. Console: `Encountered two children with the same key, attr_1`.
- **Root cause:** the column builder pushed one `attr_<id>` per principal atributo when handling `es_principal`, then again when handling each `attribute` config item — no dedup. Pre-existing bug, only surfaceable once `saveColumnConfig` actually persists (QA-013). Once QA-013 was fixed, this surfaced on the first real save.
- **Fix:** `maquinaria-client.tsx:402` — track `seenAttrIds: Set<number>` in the column-build loop and skip any duplicate `attr_<id>`.
- **Followup (UX, not blocker → backlog):** the drawer still lists principal atributos as separate togglable entries even when `es_principal` is on, which is what tempts users into the duplicate state. Either lock them while `es_principal` is visible, or hide them entirely from the drawer (they're already controlled together).

## QA-015 · Nueva factura: lines stay empty after picking proveedor

- **Module:** Compras (Phase 5, `/compras/facturas/nueva`)
- **Severity:** **blocker** (admin can't invoice received goods)
- **Status:** **fixed (uncommitted)**
- **Repro:** open `/compras/facturas/nueva` (no proveedor in URL) → pick a proveedor that has unfacturated recepciones (e.g. ALDO DIAS) → table stays empty even though `?proveedorId=N` is in the URL and the server returns the rows.
- **Root cause:** the form-client seeded `lineState` via `useState(() => lineas.map(...))`. Initial seeding only runs once, so when picking the proveedor caused a server re-render with new `lineas` props, `lineState` stayed empty (initial empty seed) and the rendered table iterated `lineState`, not `lineas`.
- **Fix:** added a `useEffect` that resets `lineState` whenever `lineas` changes. Switching proveedor wipes line selections, which is the desired UX anyway.
- **Why it didn't surface earlier:** would only manifest if you hit the page without `?proveedorId` first (the typical path from the listing button) and then chose a proveedor in the form. Hitting the URL with `?proveedorId=N` directly always worked.

## QA-016 · Nueva factura: disabled "Guardar" button gives no signal what's missing

- **Module:** Compras (Phase 5, `/compras/facturas/nueva`)
- **Severity:** medium
- **Status:** **fixed (committed, 1c419e7)**
- **Repro:** open the form, fill some but not all required fields → "Guardar" stays disabled with no hint why.
- **Fix:** required field labels now carry a `*` (proveedor, Nº factura); the disabled save button sits above a small `text-muted-foreground` caption listing exactly what's missing ("Falta: proveedor, precio en cada línea seleccionada"). Reasons computed from the same predicate that drives `canSave`, so the list stays in sync.
- **Not in scope:** `/compras/recepciones/nueva` and `/compras/requisiciones/[id]/asignar` weren't touched. They share the disabled-button pattern but have different shapes — track separately if the same complaint recurs.

## QA-017 · Estadísticas: facturación-mes sparkline only fills ~30% of its KPI card

- **Module:** Estadísticas (Phase 7, Slice A — `/estadisticas`)
- **Severity:** medium
- **Status:** **fixed** — `SparkLine` now renders `width="100%"` + `preserveAspectRatio="none"` on the SVG; consumer at `/estadisticas` passes `className="w-full"`. Internal coordinate math stays in the 280-unit viewBox space. Knock-on sweep: `HorizontalBarChart` was already fluid; `PriceChart` stays fixed-width (wrapped in `overflow-x-auto` by design); `AbcPie` is intentionally square (size-constrained).
- **Repro:** open `/estadisticas` at desktop width → "Facturación del mes" KPI card spans 2 columns but the sparkline visually occupies only the left third.
- **Root cause:** `SparkLine` renders an SVG with a fixed pixel `width` (`page.tsx:188` passes `width={280}`). The SVG sits unanchored inside the wider card, leaving empty space to its right.
- **Proposed fix:** make `SparkLine` fluid. In `components/stats/spark-line.tsx`, drop the literal `width` attribute on the `<svg>` (keep `viewBox`), set `width="100%"` and `preserveAspectRatio="none"`. Pass `className="w-full"` from the page. The internal coordinate math stays in the 280-unit space and stretches via the viewBox.
- **Knock-on check:** other charts (`AbcPie`, `PriceChart`, `HorizontalBarChart`) likely share the same fixed-pixel pattern. Sweep all four during the fix.

## QA-018 · Estadísticas ABC: sticky table header is semi-transparent on scroll

- **Module:** Estadísticas (Phase 7, Slice B — `/estadisticas/abc`)
- **Severity:** low
- **Status:** **fixed** (committed in `0275ab6`, bundled with QA-022).
- **Repro:** open `/estadisticas/abc` → scroll the table → header shows rows behind it through the partial transparency.
- **Root cause:** `page.tsx:89` — `<thead className="sticky top-0 z-10 bg-muted/50 ...">`. `bg-muted/50` is 50% opacity, so the row underneath bleeds through.
- **Fix:** swapped `bg-muted/50` → `bg-muted` on the 3 sticky `<thead>` (abc, maquinaria, proveedores). `/estadisticas/precios` thead is non-sticky; opacity left alone.

## QA-019 · Estadísticas maquinaria: `min=` filter triggers full server recompute

- **Module:** Estadísticas (Phase 7, Slice D — `/estadisticas/maquinaria`)
- **Severity:** medium (perf)
- **Status:** **fixed (committed, ea0c914)**
- **Repro:** open `/estadisticas/maquinaria` → toggle the "min mantenimientos" filter (`min2` ↔ `min3` ↔ `todos`) → noticeable lag while the server re-runs.
- **Root cause:** `actions.ts:computeMaqMetrics` ran every Prisma query regardless of `minFiltro`; the filter was only applied post-hoc to already-computed totals. Identical work across min values.
- **Fix:** split the route into server + client. `computeMaqMetrics` drops the `minFiltro` param and returns the full sorted row set. New `maquinaria-stats-client.tsx` owns the `min` state via `useState` + `useMemo` filter — toggling no longer round-trips. `range` (90d/ytd/todo) stays server-side because it still changes the SQL `WHERE`.

---

## Vercel Web Interface Guidelines audit (2026-04-19)

Audit of 5 routes against [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines): `/estadisticas`, `/estadisticas/abc`, `/estadisticas/maquinaria`, `/compras/facturas/nueva`, `/maquinaria/[tipoId]`. Findings are guideline-driven and complement the manual QA above.

## QA-020 · `Button` base class uses `transition-all` (Vercel anti-pattern)

- **Module:** Cross-cutting (UI primitive)
- **Severity:** low
- **Status:** **fixed (uncommitted)**
- **File:** `components/ui/button.tsx:8`
- **Rule:** "Animation › Never `transition: all`—list properties explicitly. Animate `transform`/`opacity` only."
- **Fix:** swapped `transition-all` → `transition-[color,background-color,border-color,box-shadow,opacity,transform]` (the subset the variants actually animate — bg on hover, border/ring on focus, opacity on disabled, transform on active).
- **Follow-up:** broader sweep of `components/ui/*` for `transition-all` deferred to post-cutover polish PR.

## QA-021 · `KpiCard` linked tiles have no visible focus ring on the `<a>` wrapper

- **Module:** Cross-cutting (`KpiCard`) — surfaces on `/estadisticas`
- **Severity:** medium (a11y)
- **Status:** **fixed (uncommitted)**
- **File:** `components/stats/kpi-card.tsx:73-78`
- **Rule:** "Focus States › Interactive elements need visible focus: `focus-visible:ring-*`."
- **Fix:** added `rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to the `<Link>` className in `kpi-card.tsx`, matching the inner Card's `rounded-xl`. Applied the same wrapper to the 4 lentes `<Link>` wrappers on `app/(app)/estadisticas/page.tsx`.

## QA-022 · Sticky `<thead>` opacity issue extends beyond ABC

- **Module:** Estadísticas (Phase 7 — `/estadisticas/abc`, `/estadisticas/maquinaria`, `/estadisticas/proveedores`) + factura form
- **Severity:** low (extends QA-018)
- **Status:** **fixed** (committed in `0275ab6`).
- **Fix:** swapped `bg-muted/50` → `bg-muted` on the 3 sticky `<thead>` (abc, maquinaria, proveedores). Factura form thead (`bg-muted/40`) and `/estadisticas/precios` thead are non-sticky → no scroll bleed → opacity intentionally retained for hierarchy.

## QA-023 · Factura nueva: form inputs missing `name`, `autocomplete`, and per-row `aria-label`

- **Module:** Compras (`/compras/facturas/nueva`)
- **Severity:** medium (a11y + browser autofill)
- **Status:** open
- **Files:** `app/(app)/compras/facturas/nueva/factura-form-client.tsx`
- **Rule:** "Forms › Inputs need `autocomplete` and meaningful `name`. Form controls need `<label>` or `aria-label`."
- **Specifics:**
  - L257-263 `numeroFactura` — no `name`, no `autocomplete="off"` (keeps password managers from firing on a non-credential field).
  - L267-273 `fechaFactura` — same.
  - L361-370 per-line `precio` `<Input>` — no `name`, no `aria-label`. The `<th>` "Precio unit." is the only label, which screen readers won't associate per row.
  - L372-383 per-line `descuento` — same.
  - L410-418, L423-431, L437-444, L454-462 totals inputs (`descuentoComercial`, `descuentoFinanciero`, `recargo`, `ivaPorcentaje`) wrap `<Label>` with no `htmlFor` — clickable label dead.
- **Proposed fix:** add `name`, `autoComplete="off"`, and per-input `aria-label={t("...")}` on tbody inputs; convert totals labels to `htmlFor`/`id` pairs.

## QA-024 · Numeric inputs missing `inputMode` for mobile keyboards

- **Module:** Cross-cutting (Compras factura form, totals, price inputs)
- **Severity:** low
- **Status:** open
- **Rule:** "Forms › Use correct `type` (`email`, `tel`, `url`, `number`) and `inputmode`."
- **Where:** factura nueva price/descuento/totals inputs (`type="number"` only). Same applies to inventario stock fields, maquinaria horometros, and any other money/quantity inputs we haven't checked.
- **Proposed fix:** add `inputMode="decimal"` to monetary inputs and `inputMode="numeric"` to integer-only ones. Audit all `type="number"` instances during the batch.

## QA-025 · Long text columns can break layout (no `truncate` / `min-w-0`)

- **Module:** Estadísticas ABC + maquinaria-stats; factura nueva description column
- **Severity:** low
- **Status:** open
- **Rule:** "Content Handling › Text containers handle long content: `truncate`, `line-clamp-*`, or `break-words`. Flex children need `min-w-0`."
- **Where:**
  - `app/(app)/estadisticas/abc/page.tsx:124` — `r.descripcion ?? "—"` rendered raw inside `<td>`. Long descriptions force horizontal scroll.
  - `app/(app)/estadisticas/maquinaria/page.tsx:147` — `r.nombre` likewise.
  - `app/(app)/compras/facturas/nueva/factura-form-client.tsx:344-351` — itemDescripcion + itemCodigo stacked without truncation.
- **Proposed fix:** wrap with `<span className="line-clamp-2 break-words">` or set a `max-w-[420px] truncate` on the `<td>`; ensure parent flex/grid items have `min-w-0` where applicable.

## QA-026 · Loading and saving labels missing ellipsis (`…`)

- **Module:** Cross-cutting (i18n message catalog)
- **Severity:** low
- **Status:** **already compliant**
- **Verification (2026-04-19):** `grep '\\.\\.\\.'` against `messages/es.json` returns 0 matches; all `Guardando` keys end with the unicode `…` already. No inline `Guardando...` / `Cargando...` strings in `*.{ts,tsx}` either.

## QA-027 · `Intl.NumberFormat` not used uniformly — `toFixed`/`toLocaleString` mixed in tables

- **Module:** Estadísticas ABC, KPI dashboard
- **Severity:** low
- **Status:** open
- **Rule:** "Locale & i18n › Numbers/currency: use `Intl.NumberFormat` not hardcoded formats."
- **Where:**
  - `app/(app)/estadisticas/abc/page.tsx:138,141` — `r.porcentaje.toFixed(1)` and `r.acumulado.toFixed(1)`. Always `.` decimal, ignores `es-AR` (`,`).
  - `app/(app)/estadisticas/page.tsx:144,154,163,170,176,180` — `kpi.X.toLocaleString("es-AR")` instead of a memoised `Intl.NumberFormat` instance.
- **Proposed fix:** introduce module-scope `numberFormatter`, `percentFormatter`, `currencyFormatter` (Intl) and use them everywhere a number renders. Memo at module level avoids recreating per render.

## QA-028 · Tables with growth potential lack virtualization signal

- **Module:** Mantenimiento (QA-002 already), Estadísticas tables (ABC ~items count, Maquinaria ~máquina count)
- **Severity:** low (perf — current data fits)
- **Status:** open / monitor
- **Rule:** "Performance › Large lists (>50 items): virtualize."
- **Where:** No `<table>` in this audit uses `virtua`, `content-visibility: auto`, or pagination beyond the 600px scroll cap. Mantenimiento (129 rows today) is the only one over the threshold; the rest will grow over time.
- **Proposed fix:** add server-side pagination per QA-002 to mantenimiento, then revisit ABC + maquinaria-stats once data grows. `content-visibility: auto` on tbody rows is a cheap intermediate step.

---

## Vercel guidelines audit Round 2 (2026-04-19)

Extended the audit beyond the original 5 routes. Surface scan covered all `app/(app)/*-client.tsx` plus `compras/{recepciones,oc,facturas}/*`, `mantenimiento/{[id],horometros,plantillas,nuevo}`, `inventario/{[id]/movimientos,movimientos}`, `estadisticas/{precios,proveedores}`, `ordenes-trabajo/*`. Findings are systemic rather than per-route; one entry covers all occurrences.

## QA-029 · DataTable action cells use `<div onClick={stopPropagation}>` wrapper

- **Module:** Cross-cutting (every list using DataTable with row click + actions menu)
- **Severity:** low (a11y + anti-pattern)
- **Status:** open
- **Files:** `app/(app)/inventario/inventario-client.tsx:382`, `maquinaria/[tipoId]/maquinaria-client.tsx:521`, `maquinaria/tipos/tipos-client.tsx:247`, plus 8 listados clients (`unidades-medida`, `tipos-unidad`, `unidades-productivas`, `usuarios`, `proveedores`, `localidades`, `roles`) and `compras/recepciones/recepciones-list-client.tsx:77`.
- **Rule:** "Anti-patterns › Avoid `<div onClick>`; use semantic elements." A `<div>` capturing pointer events isn't keyboard-reachable and screen readers see nothing.
- **Why we did it:** DataTable rows are clickable; the action menu trigger needs to swallow the row's click. The `<div>` is just an event sink.
- **Proposed fix:** lift `stopPropagation` into the action menu's own button (it's a `<button>` already — adding `onClick={(e) => e.stopPropagation()}` directly to it removes the wrapper div). Alternatively, refactor DataTable to expose `onRowClick` that ignores clicks originating inside `[data-row-actions]`.

## QA-030 · `<th>` elements missing `scope="col"`

- **Module:** Cross-cutting (every table)
- **Severity:** low (a11y)
- **Status:** **fixed (uncommitted)**
- **Rule:** "Tables › `<th scope="col|row">` for headers; `<caption>` for context."
- **Fix:** added `scope = "col"` default to `TableHead` in `components/ui/table.tsx` (propagates to every consumer; overridable per call site). Added `scope="col"` to all hand-rolled `<th>` in `app/(app)/estadisticas/{abc,maquinaria,proveedores,precios}/page.tsx`.

## QA-031 · `autoFocus` on every form-sheet primary input

- **Module:** Cross-cutting (form sheets across listados + maquinaria + inventario)
- **Severity:** low (UX on tablet; backlog mobile/tablet QA item is QA-003)
- **Status:** open
- **Where:** 13 occurrences in `components/inventario/movement-dialog.tsx`, `components/app/structure-tree.tsx`, `inventario-client.tsx:553`, `maquinaria/tipos/tipos-client.tsx:328`, plus all 7 listados clients.
- **Rule:** "Forms › Use `autofocus` sparingly—desktop only, single primary input; avoid on mobile."
- **Why this matters here:** Cervi uses tablets in chacra (per backlog QA-003). On tablet, `autoFocus` on a sheet open immediately summons the on-screen keyboard, which obscures the rest of the form. Should be either removed or gated on `matchMedia("(pointer: fine)").matches`.
- **Proposed fix:** centralise behind a `useDesktopAutoFocus()` hook (returns `{ ref }` that calls `.focus()` only on `matches`); replace the 13 `autoFocus` props with the hook.

## QA-032 · Inventario "Facturas (próximamente)" disabled tab is a UX anti-pattern

- **Module:** Inventario detail (Phase 2)
- **Severity:** low
- **Status:** open / deferred
- **File:** `app/(app)/inventario/inventario-client.tsx:771-773` — `<TabsTrigger value="facturas" disabled>Facturas (próximamente)</TabsTrigger>`. Spec calls for this stub (`docs/ux-spec/2-inventario.md:79`).
- **Rule:** "Content & Copy › Don't show disabled UI for unbuilt features. Either ship it or hide it."
- **Why now:** Phase 5 Compras shipped — facturas exist. The stub was a Phase 2 placeholder for "Facturas arrives in Phase 5" and is now stale. The tab should either (a) wire up to the actual factura history filtered to this item, or (b) be removed.
- **Proposed fix:** replace the disabled tab with a real query: `factura.lineas.findMany({ where: { itemInventarioId: id }, include: { factura: { include: { proveedor: true } } } })`. Render in the tab body. Cheap; data already exists.
- **Hardcoded string:** while there, also note `inventario-client.tsx:412` hardcodes the Spanish delete-warning string ("Si el item tiene movimientos…") — should move to `messages/es.json`. Bundle into the same fix.

## QA-033 · `type="number"` instances missing `inputMode` extend beyond factura form

- **Module:** Cross-cutting (extends QA-024)
- **Severity:** low
- **Status:** open
- **Where (full list — 16 occurrences):** `ordenes-trabajo/[id]/ot-detail-client.tsx:696,722` · `compras/recepciones/nueva/recepcion-form-client.tsx:308` · `mantenimiento/plantillas/plantilla-form.tsx:309,403` · `mantenimiento/horometros/horometros-client.tsx:264` · `inventario/inventario-client.tsx:658` · `compras/facturas/nueva/factura-form-client.tsx:362,374,411,425,437,455` · `maquinaria/[tipoId]/maquinaria-client.tsx:717,880`.
- **Rule:** Same as QA-024.
- **Proposed fix:** sweep all 16 in one batch. `inputMode="decimal"` for money/quantities/horometros, `inputMode="numeric"` for integer-only (frequencies, días).

## QA-034 · Dates formatted with `date-fns` instead of `Intl.DateTimeFormat`

- **Module:** Cross-cutting i18n (extends QA-027 to the date side)
- **Severity:** low
- **Status:** open
- **Where:** 24 files import `format`/`parseISO` from `date-fns` (e.g. `mantenimiento/mantenimientos-client.tsx`, `ordenes-trabajo/ot-list-client.tsx`, every compras list, every listados client). Pattern: `format(new Date(s), "dd/MM/yyyy", { locale: es })`.
- **Rule:** "Locale & i18n › Numbers/currency/dates: use `Intl.*` not hardcoded formats."
- **Why this matters:** date-fns ships as a runtime dependency we already pay for, but the locale handling is parallel to `Intl.DateTimeFormat`. Two systems means inconsistent output (date-fns writes `19/04/2026`, Intl with `es-AR` writes `19/4/26` by default, `19/04/2026` with explicit options) and we ship duplicate locale data.
- **Proposed fix:** introduce `lib/intl.ts` exposing module-scope `dateFormatter`, `dateTimeFormatter`, `numberFormatter`, `currencyFormatter`, `percentFormatter` (all `Intl.*`). Migrate the 24 date-fns import sites; once at zero, drop date-fns from `package.json`.
- **Risk to flag:** `parseISO` is also used; replace with `new Date(s)` (legacy data is ISO-8601 already per probe).

## QA-035 · `aria-*` attributes are sparse across the app

- **Module:** Cross-cutting (a11y)
- **Severity:** medium (a11y baseline)
- **Status:** open
- **Signal:** `grep -c 'aria-label\|aria-describedby\|aria-live\|role=' app/` returns 8 occurrences across 6 files for the entire `app/` tree. This is far below what a 30-page CRUD app should have — the icon-only buttons (action menus, close buttons, sort toggles) are unlabelled to assistive tech, toast regions aren't announced (`aria-live`), and disabled-button reasons (QA-016) have no `aria-describedby` hook.
- **Rule:** "Accessibility › Icon-only `<button>` needs `aria-label`. Live regions need `aria-live`. Validation messages need `aria-describedby`."
- **Proposed fix:** triage in three passes:
  1. Add `aria-label` to every icon-only button (action menu trigger, drawer close, sort caret) — sweep `components/ui/data-table.tsx` and consumers.
  2. Wrap toast container in `aria-live="polite"` (Sonner does this if configured).
  3. When fixing QA-016 (disabled-button reason), surface the reason via `aria-describedby` linked to a `sr-only` span.
- **Note:** this is an audit observation, not a "we tested with a screen reader" finding. A real a11y pass post-cutover may surface more.

---

## Parity-audit findings (2026-04-19)

Legacy-vs-web feature sweep against `Agimav23b.py`. Items below are gaps the audit flagged that aren't covered by QA-001…QA-035.

## QA-036 · Opciones module is a placeholder — hide from nav before cutover

- **Module:** Cross-cutting (app shell + `/opciones`)
- **Severity:** medium (user-visible dead entry point)
- **Status:** **fixed** — `lib/nav.ts` entry removed (+ unused `Settings` icon import dropped), `/opciones` route deleted, `nav.opciones` + `placeholder.descripcionModulo.opciones` i18n keys removed from `messages/es.json`, `docs/cutover-runbook.md` "Known non-blockers" section now documents admin procedures for backup/restore/wipe/import-export.
- **Context:** parity audit confirmed `/opciones` renders `PlaceholderModule`. Legacy Opciones grouped backup/restore, wipe-by-módulo, and Excel import/export per módulo — none migrated. In the new deployment these are platform-level or admin-via-scripts: backup = Neon PITR, restore = support ticket, wipe/import/export = SQL scripts. The placeholder link in the nav will confuse Cervi post-cutover ("where did the old menu go?").
- **Proposed fix:**
  - Remove the nav link to `/opciones` (or gate it `isAdmin`-only with a "próximamente" badge if we expect to revive any of these as UI).
  - Delete the placeholder route or keep it behind a flag — don't ship a clickable dead-end.
  - Add one paragraph to `docs/cutover-runbook.md` (under "Known non-blockers") stating the admin procedures for backup/restore/wipe/import/export so Cervi has a pointer when they ask.
- **Why not defer:** cheapest fix before T-0 — hiding a nav link is a one-line change.

## QA-037 · Allow recepciones to close without a factura

- **Module:** Compras (Phase 5, Slices D + E)
- **Severity:** medium (missing legacy path)
- **Status:** open
- **Context:** parity audit flagged that legacy has a "Completar remitos sin factura" action on recepciones (`Agimav23b.py` ~line 18927). Real business case: supplier returns, free replacements, damaged-goods remitos that never get invoiced. Today the web app only closes recepción lines on factura creation, so these recepciones stay "open" forever and keep showing up in `/compras/facturas/nueva`.
- **Proposed fix:**
  - Add a "Cerrar sin factura" action on the recepción detail page (admin-gated).
  - Introduce a `cerradaSinFactura: boolean` column on `Recepcion` (or a new terminal estado). Closing marks the lines exempt from the unfacturated-lines query that feeds factura-nueva.
  - **Does NOT** write `PrecioHistorico`, does NOT update `Inventario.valorUnitario`, does NOT trigger additional `InventarioMovimiento` beyond what the recepción already did at Stock-destino time.
  - Historial entry so the reason is auditable (`tipo_cambio='cerrada_sin_factura'`, free-text motivo).
- **Spec touch-up:** update `docs/ux-spec/4-compras.md` with the new terminal state so future work doesn't drop it again.
- **Scope note:** Cervi confirmed (2026-04-19) this is real, not legacy cruft — for now, just wire it up.

---

## Triage

- **Blockers:** ~~QA-004, QA-008, QA-009, QA-013, QA-014, QA-015~~ — all fixed.
- **High / medium open:** QA-002, QA-006 (needs product decision), QA-023, QA-035, QA-037.
- **Fixed (committed):** QA-001, QA-005, QA-010, QA-011, QA-015, QA-016, QA-017, QA-018, QA-019, QA-020, QA-021, QA-022, QA-026, QA-030, QA-036.
- **Low / deferred:** QA-003 (already on backlog), QA-012, QA-024, QA-025, QA-027, QA-028, QA-029, QA-031, QA-032, QA-033, QA-034.
- **Fixed (uncommitted):** QA-007 (insumos editor column trim).

## Next steps

1. User reviews the use-server refactor diff and commits.
2. Resume Slice A/B QA from where it broke (plantilla detail page + insumos table).
3. Continue cataloguing UX findings as we walk Phase 6 → 4 → 5 → 7. Fixes batched at the end.
4. Decide QA-006 with Cervi or product owner before fixing.
5. Audit findings (QA-020 through QA-035) are guideline-driven, not user-reported. Pre-cutover: fix only QA-021 (a11y focus, medium) and QA-035 pass-1 (icon button aria-labels). The rest go into a single post-cutover "polish" PR or the backlog.
6. Parity-audit items QA-036 (hide Opciones nav) and QA-037 (close recepción without factura) are both pre-cutover work.
