# Phase 3 — Inventario stakeholder walkthrough

## What to demo

Walk through these flows on staging with Cervi's admin + pañolero. Use real items from the live catalog for believability.

## Pre-flight

- [ ] DB has been re-synced from latest `flota7.db` via `pnpm db:migrate-legacy`
- [ ] Cleanup script applied: `pnpm db:cleanup-inventario -- --apply`
- [ ] Dev server up on staging URL
- [ ] One admin and one pañolero test account ready
- [ ] Export file ready for the import demo (download first, then tweak 2–3 rows)

## Golden paths

### 1. Browse + search + filters (any role)
- [ ] `/inventario` loads with 672 items
- [ ] Type a partial descripción → list filters live
- [ ] Select Categoría → Localidad filters stack
- [ ] Toggle "Bajo mínimo" → only items with `stock < stockMinimo && stockMinimo > 0` remain
- [ ] Counter shows "N items · M bajo mínimo"
- [ ] Row click → detail drawer opens with KPIs + last 10 movements
- [ ] Negative stock rows show destructive badge with `−N` prefix
- [ ] Below-minimum rows show outlined destructive badge `{stock}/{min}`

### 2. Create + edit item (admin)
- [ ] `+ Nuevo` → sheet opens, código focused
- [ ] Save with unique código → appears in list, toast fires
- [ ] Save with duplicate código → inline field error + toast
- [ ] Open existing item → edit → valor unitario changes persist
- [ ] Stock field is read-only with "usá Registrar movimiento" note

### 3. Register movement (pañolero)
- [ ] Row kebab → "Registrar movimiento" → dialog opens with Entrada preselected
- [ ] Entrada: cantidad 10, valor unitario 500, motivo → stock + weighted-avg price updated
- [ ] Salida below current stock → submit → normal success
- [ ] Salida that would drive stock negative → warning banner → "confirmar" required before commit
- [ ] Ajuste de precio: new valor → logs as 0-qty entrada with `ajustes` module

### 4. Per-item history
- [ ] Kebab → "Ver historial" → `/inventario/[id]/movimientos`
- [ ] Breadcrumb: `Inventario / Movimientos`
- [ ] KPI cards show current stock / valor unitario / valor total
- [ ] Filters (tipo, módulo, desde/hasta) update URL + results
- [ ] "Registrar movimiento" from page header works and refreshes the list
- [ ] "Limpiar" button appears when any filter is active

### 5. Global movements
- [ ] `/inventario/movimientos` loads
- [ ] Same filters as per-item plus item column linking back to per-item history
- [ ] Signed cantidad column: entrada `+N`, salida `−N`

### 6. xlsx export (any role)
- [ ] `Exportar` on `/inventario` → downloads `inventario_YYYY-MM-DD.xlsx` with all 672 rows
- [ ] Headers in Spanish with accents
- [ ] Same button on `/inventario/movimientos` — respects current filters (try a date range)
- [ ] Same button on per-item history — only that item's movements, scoped filename

### 7. xlsx import (admin)
- [ ] `Importar` → drawer opens
- [ ] Drop an xlsx with 2 new items + 3 edits + 1 missing-descripción → preview shows 2 nuevos / 3 actualizados / 1 inválido
- [ ] "Importar" disabled until either no invalids or the ignore checkbox is ticked
- [ ] Commit → toast + list refreshes with changes
- [ ] Try a file > 2 MB or with no header match → error toast, not a crash

### 8. Delete (admin)
- [ ] Kebab → Eliminar → item with movements: refused with count
- [ ] New item with no movements: confirm → deleted → disappears from list

## Permissions sanity

- [ ] Mecánico role: no `Editar`, no `Registrar movimiento`, no `Importar`, no `+ Nuevo`. `Exportar` + `Ver historial` visible.
- [ ] Pañolero role: can `Registrar movimiento`, cannot `Editar`/`Importar`/`+ Nuevo`.
- [ ] Admin role: everything visible.

## Known non-issues to call out

- Negative stocks on ~20 legacy items — intentionally surfaced, not auto-fixed. Pañolero can post corrective entradas.
- `stock_minimo = 0` on most items means "Bajo mínimo" filter is quiet — working as designed.
- Item #333 has codigo `"ACOPLE "` with a trailing space the cleanup script flagged because `"ACOPLE"` already exists as a separate item. Needs manual reconciliation with Cervi (merge or rename).

## Known deferrals

- Facturas tab on item detail → placeholder only until Phase 5
- Price history timeline → Phase 5 writes, maybe Phase 3.5 to show
- Toma de inventario / physical count → not in legacy, not in v1
- ABC / rotación / USD analytics → Phase 7

## Sign-off

- [ ] Cervi admin approves to proceed to Phase 4 (Maquinaria)
- [ ] Any feedback captured in `docs/ux-spec/2-inventario.md` as deviations

## Rollback (if needed)

Re-run `pnpm db:migrate-legacy` to reset dev Postgres from `flota7.db`. No other state is touched.
