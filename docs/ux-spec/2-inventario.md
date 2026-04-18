# UX Spec 2 — Inventario

Scope: item master (`inventario`) + movements (`inventario_movimientos`) + low-stock alerts + Excel import/export. This is the first **transactional** module in the app — every write changes stock and cost values that later feed Compras, Mantenimiento, Órdenes de Trabajo, and Estadísticas. Getting the movement/stock bookkeeping right here is load-bearing for every later phase.

## 1. Purpose & user

Give Cervi a single place to:

- keep the catalog of consumables, repuestos, lubricantes, insumos (~670 items today) clean and searchable;
- record manual entradas/salidas/ajustes when a later module isn't driving the movement (purchase deliveries, maintenance consumption, and OT consumption all flow in automatically in later phases — this module handles the residual manual events and the audit trail);
- see what's below minimum at a glance so the `Pañolero` can flag a restock before Compras opens a requisition.

- **Primary actor:** `Pañolero` — owns day-to-day inventory accuracy, registers manual movements, watches alerts.
- **Secondary actor:** `Administrador` — creates/edits the item master, runs Excel imports, fixes data.
- **Read-only actors:** `Mecánico`, other roles — look up stock levels, prices, and history before requesting parts.
- **Primary job-to-be-done:** *"Do we have four of X in stock? If not, is it on its way?"* — the answer needs to be current, and the movement that justifies the current number needs to be traceable.
- **Why it matters:** every Compras, Mantenimiento, and OT workflow writes to `inventario_movimientos`. If this module's read paths lie (stale stock, missing history), users stop trusting the whole app and go back to calling on the phone. Cost accuracy (weighted-average `valor_unitario`) also feeds Estadísticas and management reporting.

## 2. Reality check — what the data actually looks like today

Probe on current Neon snapshot (2026-04-18):

- **672 items** in `inventario`; **563 movements** in `inventario_movimientos`.
- **53 distinct `categoria` values** — free-text, mixed casing, trailing spaces (`"CAJA DE CAMBIOS "`, accents inconsistent). Top 5: `ACCESORIOS` (81), `EMBRAGUE` (40), `DIRECCIÓN` (38), `MOTORES` (36), `RODAMIENTOS/COJINETES` (30).
- **Only 2 distinct `unidad_productiva`** values populated (most items sit in "Pañol"). Legacy form offered it but users rarely changed the default.
- **272 items "below minimum"** — inflated because most `stock_minimo = 0`, so the filter mostly surfaces items with *negative* stock (data debt from the legacy app overdrawing inventory).
- **Movement mix:** `salida/mantenimiento` 308, `entrada/compras` 206, `salida/ot` 34, `salida/mov_diario` 10, `entrada/mantenimiento` 3, `entrada/ot` 1, `entrada/ajustes` 1. Only `entrada`/`salida` `tipo` values exist — no pure `ajuste` tipo (the legacy "ajuste de precio" logs as a 0-quantity `entrada`).
- **Data debt to expect, not fix inside forms:**
  - Leading/trailing whitespace on `codigo` and `descripcion` (`" ACEITE HIDRO 19 T205"`).
  - Mixed casing on denormalized text fields (`"NEUQUEN"` vs `"Neuquén"`).
  - Empty strings where nulls would fit (`localidad = ""`, `unidad_productiva = ""`).
  - Negative stocks on 20+ items (overdrawn in legacy; we surface them loudly, we don't auto-correct).
  - `valor_total` is a **stored** column that doesn't always equal `stock * valor_unitario` (legacy drift).

Implications for the spec:

1. Trim `codigo` and `descripcion` on every write going forward. Not bulk-cleaning legacy rows — too risky without user sign-off.
2. Keep denormalized text fields (`localidad`, `unidad_productiva`, `unidad_medida`) as text — **don't migrate to FKs in Phase 3**. Legacy parity + no backfill risk. Form uses listados as autocomplete source.
3. Treat `valor_total` as **derived at read time** (`stock * valor_unitario`), ignoring the stored column. Stored column continues to be kept in sync on writes for backwards-compat with any Python tool still running against the DB during transition, but the UI never reads it directly.
4. Stock alert filter uses `stock < stock_minimo` AND `stock_minimo > 0` so we don't flood the alerts view with legacy zero-minimums.

## 3. Scope & shipping plan

Four entities of UX work, four mergeable slices. Each slice ships on its own.

### Slice A — Item CRUD + list + detail drawer (PR #1)

- List page at `/inventario` with search, filters (categoría, localidad, estado stock), sort.
- Edit Sheet for item master fields.
- Row click opens detail drawer with summary + last 10 movements + full history link.
- Alerts **filter toggle** on the list (`Stock bajo mínimo`), no separate page.
- Delete is **block-on-FK** (if item has movements, requisicion lines, OC/OT/mantenimiento/plantilla uses, or maquina-atributo refs → refuse).
- No manual movements yet — just the master.

### Slice B — Manual movements + per-item history (PR #2)

- Row action "Registrar movimiento" → Dialog with tipo radio (`Entrada` / `Salida` / `Ajuste de precio`).
- Entrada: qty + valor_unitario + motivo. Updates stock and weighted-average price.
- Salida: qty + motivo (+ who/where free-text). Warns if it would drive stock negative; requires confirm.
- Ajuste de precio: new valor_unitario + motivo. Logs as a 0-qty `entrada` with module `ajustes` (matches legacy shape).
- Per-item movement history page (`/inventario/[id]/movimientos`) with tipo + date-range + módulo filters.
- Global movements page (`/inventario/movimientos`) with item + tipo + módulo + date filters.

### Slice C — Excel export + import (PR #3)

- Export: server-side SheetJS generation of full catalog (not filtered view — full audit expected).
- Import: upsert-by-`codigo` only. **No "replace" mode** (legacy `reemplazar` truncates the table; too dangerous). Preview diff (new / updated / unchanged / invalid) before commit.
- Movement Excel export (filtered) from the movements page.

### Slice D — Cleanup pass + stakeholder review (PR #4)

- Fix i18n gaps flagged during build.
- One-off script to trim whitespace in `codigo` / `descripcion` / `categoria` — behind a pnpm command, not auto-run.
- Stakeholder walkthrough on staging.

**Out of this module entirely** (explicit, so we don't scope-creep):

- ABC / USD / rotación dashboards — **Phase 7 Estadísticas** per master plan.
- Factura history on an item — needs the Facturas model, arrives in **Phase 5 Compras**. We leave a stub tab "Facturas (próximamente)" in the item detail so the place is obvious.
- Price history timeline — writes to `precios_historico` happen automatically from Phase 5 invoicing; this module shows the timeline but doesn't create entries.
- Physical inventory count / toma de inventario — **not** in legacy, **not** in v1.

## 4. Schema touches (pre-build)

The `inventario` and `inventario_movimientos` tables already exist from Phase 1's migration. Current shape (verified against `prisma/schema.prisma`):

- `Inventario` has **no audit columns at all** (no `createdAt`, `updatedAt`, `createdById`). Legacy schema was equally bare. `codigo` is `String? @unique` (nullable but unique).
- `InventarioMovimiento` already has `createdAt`. No `createdById`. Existing indexes: single-column `[idItem]`, `[fecha]`, `[moduloOrigen]`.
- All numeric fields (`stock`, `stockMinimo`, `valorUnitario`, `valorTotal`, movement `cantidad`/`valorUnitario`) are Postgres `double precision` (`Float` in Prisma). No `Decimal` — legacy parity. Rounding lives in the UI.

Adjustments for Phase 3:

1. **Audit columns on `Inventario`.** Migration adds `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `createdById Int?` (nullable FK → `Usuario`). All nullable/defaulted so legacy rows survive.
2. **Actor on movements.** `InventarioMovimiento` gains `createdById Int?` (nullable FK → `Usuario`). Text `usuario` stays for legacy parity and free-form cases (e.g., import); `createdById` is the auth'd actor when present.
3. **Indexes for hot paths.** Current single-column indexes stay; we add composites that better match our queries:
   - `inventario (lower(unaccent(descripcion)))` — descripcion search (new; `pg_unaccent` extension already enabled in the listados audit-columns migration).
   - `inventario_movimientos (id_item, fecha DESC)` — per-item history.
   - `inventario_movimientos (fecha DESC)` — global history (already exists as `[fecha]`; extend only if query planner needs it after benchmarking).
   - `inventario_movimientos (modulo_origen, fecha DESC)` — módulo filter.
4. **No FK migration** for denormalized text fields (see §2 rationale).
5. **`codigo` uniqueness.** Current `@unique` on nullable `codigo` treats nulls as distinct (Postgres default), but rows with `codigo = NULL` create ambiguity for upsert. During import, rows without `codigo` are rejected (see §5.6). No schema change needed.
6. **No check constraint** on `cantidad`. Legacy tolerates edge cases; UI enforces positivity.
7. **Backfill** — none. Migration is purely additive.

## 5. Screens

Five surfaces. Wireframes show intended information density; exact visual polish follows foundation tokens.

### 5.1 List — `/inventario`

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Inventario                                             [Importar] [Exportar] [+ Nuevo] │
│ Catálogo de insumos, repuestos y consumibles.                                      │
│ ────────────────────────────────────────────────────────────────────────────────── │
│ [Buscar código o descripción… 🔎]  [Categoría ▾]  [Localidad ▾]  [⚠ Bajo mínimo ✓] │
│                                                              672 items · 4 bajo min │
│ ────────────────────────────────────────────────────────────────────────────────── │
│ Código      │ Descripción              │ Categoría      │ Stock      │ Precio u. │⋯│
│ ────────────────────────────────────────────────────────────────────────────────── │
│ 125992      │ ACEITE HIDRO 19 T205     │ LUBRICANTES    │ 208 LITROS │  $0,00    │⋯│
│ 189092      │ ACEITE EXTRA VIDA XV100  │ LUBRICANTES    │ 247 LITROS │ $718.463  │⋯│
│ 35x50       │ ABRAZADERAS              │ ACCESORIOS     │ 🟥 −5 UN   │  $3.400   │⋯│
│ ABZ-25      │ ABRAZADERA 25mm          │ ACCESORIOS     │ 🟧 1/5 UN  │  $2.100   │⋯│
│ ...                                                                                │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header actions** (admin only for `Importar`/`+ Nuevo`; `Exportar` available to everyone):
  - `+ Nuevo`: opens item Sheet in create mode.
  - `Importar`: opens Import drawer (slice C). Admin only.
  - `Exportar`: downloads current filter view as xlsx.
- **Filter row:**
  - Search input — debounced, matches on `codigo` (exact + prefix) and `descripcion` (ILIKE unaccent).
  - Categoría select — populated from distinct `categoria` values.
  - Localidad select — populated from distinct `localidad` values (text, not listados FK for now).
  - `Bajo mínimo` toggle — boolean filter `stock < stock_minimo AND stock_minimo > 0`.
  - Result count + sub-count of how many are below minimum within the current filter.
- **Stock column visual rules** (single decision table so every place that renders a stock cell agrees):

  | Condition | Rendering |
  |---|---|
  | `stock < 0` | red badge, value prefixed with `−`, tooltip *"Stock negativo — revisar"* |
  | `stock_minimo > 0 AND stock < stock_minimo` | orange badge, value as `{stock}/{min}` |
  | `stock == 0 AND stock_minimo == 0` | muted `0`, no badge |
  | otherwise | plain number |

  Unit shown as a small gray suffix (`208 LITROS`).

- **Precio unitario column:** ARS formatting `$X.XXX,XX` using `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })`. `$0,00` rendered muted.
- **Sort:** default by `descripcion` asc. All sortable columns: código, descripción, categoría, stock, precio unitario.
- **Row click:** opens detail drawer (§5.3).
- **Row kebab (⋯):**
  - `Editar` (admin) — opens edit Sheet.
  - `Registrar movimiento` (admin + pañolero) — opens Movement dialog (slice B).
  - `Ver historial` — navigates to per-item history page.
  - `Eliminar` (admin) — block-on-FK; disabled with tooltip when any dependency exists.
- **Empty state** (no items at all): `No hay items en inventario. Creá el primero.` + CTA.
- **No-results state** (filter active): `No hay resultados para "xyz". Limpiá los filtros.` + clear-filters button.
- **Pagination:** client-side for 672 rows is fine today. Budget: if the table passes 2,000 rows we add cursor pagination. TanStack Table will do the in-memory work.

### 5.2 Item Sheet (create / edit) — side panel

```
┌─────────────────────────────────────────┐
│ Editar item                          ×  │
├─────────────────────────────────────────┤
│ Código *                                │
│ [125992______________________]          │
│                                         │
│ Descripción *                           │
│ [ACEITE HIDRO 19 T205____________]      │
│                                         │
│ Categoría           Unidad de medida    │
│ [LUBRICANTES ▾]     [LITROS ▾]          │
│                                         │
│ Localidad           Unidad productiva   │
│ [Neuquén ▾]         [Pañol ▾]           │
│                                         │
│ Stock mínimo        Valor unitario      │
│ [0______]           [0,00________]      │
│                                         │
│ Stock actual: 208 LITROS                │
│ (Para ajustar stock, usá "Registrar     │
│ movimiento" desde la fila.)             │
│                                         │
│ Creado 2025-12-14 por admin             │
│ Editado hace 3 días por admin           │
├─────────────────────────────────────────┤
│               [Cancelar] [Guardar]      │
└─────────────────────────────────────────┘
```

- **Obligatorios:** `codigo`, `descripcion`. Everything else optional (matches legacy).
- **Categoría:** Combobox backed by distinct `categoria` values from DB plus "crear nuevo" affordance (`Crear "XYZ"` appears when typed value isn't in the list). Free-text in practice, guided by autocomplete.
- **Unidad de medida:** Combobox sourced from `UnidadMedida` listados; free-text fallback for the unlabeled legacy cases (empty strings).
- **Localidad:** Combobox sourced from `Localidad` listados.
- **Unidad productiva:** Combobox sourced from `UnidadProductiva` listados, filtered by selected localidad (mirrors legacy cascade). No hard FK — writes the text name.
- **Stock actual** is **read-only** in this form. Stock only moves through movements (slice B) — this enforces that the audit trail is the source of truth for `stock`, not ad-hoc edits. Legacy didn't enforce this; we're fixing a known footgun.
- **Valor unitario** is editable from Slice A (legacy allows it too), but every save writes a `precios_historico` row + an `ajustes` movement so the change is traced. This gets the full wiring in Slice B; in Slice A, valor unitario edits *only* update the item master (simpler pilot). Documented as deviation if the reviewer wants the full wiring in A.
- **Code uniqueness:** validated on submit. Conflict toast: `Ya existe un item con código "ABC".`
- **Unsaved-changes guard:** same pattern as listados (`FormSheet`).

### 5.3 Item detail drawer (read-first, any role)

Opens on row click. Three tabs; third is a placeholder until Phase 5.

```
┌──────────────────────────────────────────────────────────────┐
│ ACEITE HIDRO 19 T205                    [Editar] [Movimiento] │
│ Código 125992 · LUBRICANTES · Pañol, Neuquén                  │
│ ─────────────────────────────────────────────────────────── │
│  Resumen │ Movimientos (312) │ Facturas (próximamente)         │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│  Stock actual        Stock mínimo     Valor unitario         │
│  208 LITROS          0 LITROS         $0,00                   │
│                                                             │
│  Valor total actual: $0,00                                   │
│                                                             │
│  Últimos movimientos                                         │
│  ──────────────────────────────────────────────────────     │
│  2026-04-17  salida   1 UN   $54.500  Mantenimiento #129     │
│  2026-04-12  entrada  20     $718.463 Compra OC-000421       │
│  2026-04-09  salida   2 UN   $9.200   OT #88                 │
│  ...                                                         │
│  [Ver todo el historial →]                                   │
└──────────────────────────────────────────────────────────────┘
```

- Drawer = `Sheet` side=right, `sm:max-w-2xl`. Bigger than edit sheet because the movements table inside is dense.
- **Tab 1 Resumen:** 3 KPI cards + last 10 movements + link to full history.
- **Tab 2 Movimientos:** full paginated list for this item. Date range, tipo, and módulo filters.
- **Tab 3 Facturas:** empty-state placeholder until Phase 5. Tab visible but disabled is fine.
- Actions in drawer header: `Editar` (admin), `Registrar movimiento` (admin + pañolero).
- Non-admin → same drawer, action buttons hidden.

### 5.4 Movement dialog (slice B)

Modal Dialog (not a sheet — quick, one-shot input).

```
┌───────────────────────────────────────────┐
│ Registrar movimiento — ACEITE HIDRO 19    │
│ Código 125992 · Stock actual: 208 LITROS  │
├───────────────────────────────────────────┤
│ Tipo                                      │
│ ( ) Entrada    ( ) Salida   ( ) Ajuste de precio │
│                                           │
│ Cantidad *               Unidad            │
│ [_______]                LITROS (fija)     │
│                                           │
│ Valor unitario *         Total              │
│ [0,00_____]              $0,00 (derivado)   │
│                                           │
│ Motivo *                                  │
│ [_________________________________]       │
│                                           │
│ Observaciones                             │
│ [_________________________________]       │
│                                           │
│ ⚠ Esta salida dejaría el stock en −3.     │
│   Confirmá que es correcto.                │
├───────────────────────────────────────────┤
│                  [Cancelar] [Registrar]   │
└───────────────────────────────────────────┘
```

- **Tipo switches which fields render:**

  | Tipo | Fields | Effect |
  |---|---|---|
  | Entrada | cantidad*, valor_unitario*, motivo*, observaciones | `stock += qty`; weighted-average `valor_unitario` = `(old_stock * old_val + qty * new_val) / (old_stock + qty)`. Writes `movimiento { tipo: "entrada", modulo_origen: "mov_diario" }`. |
  | Salida | cantidad*, motivo*, observaciones | `stock -= qty`. `valor_unitario` of the movement is the current item `valor_unitario`. Writes `movimiento { tipo: "salida", modulo_origen: "mov_diario" }`. Warns (not blocks) if resulting stock < 0. |
  | Ajuste de precio | nuevo_valor_unitario*, motivo* | `valor_unitario := new`. Writes `movimiento { tipo: "entrada", cantidad: 0, valor_unitario: new, modulo_origen: "ajustes" }`. Matches legacy shape exactly for data continuity. |

- **Server Action wraps in a Prisma interactive transaction:** update `inventario` row and insert `inventario_movimientos` row in one transaction. Non-negotiable — bookkeeping integrity.
- **`motivo` required** for all three to create a usable audit trail. Legacy allowed empty; we're tightening.
- **`usuario` text** = current session user's display name. `createdById` = session user id. Both written.
- **Negative-stock path:** if salida would produce `stock < 0`, dialog shows an AlertDialog-style inline warning and a secondary confirm. The save still succeeds — legacy tolerates negative stock (see §2) — but the user is slowed down. Rationale: blocking outright would leave real-world overdraws stuck; warning + confirm makes the act deliberate.
- **Valor unitario on Entrada:** prefilled with current `valor_unitario`. Users can override per delivery.
- Dialog closes on success; toast: `Movimiento registrado.` Detail drawer refetches.

### 5.5 Global movements page — `/inventario/movimientos`

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Movimientos de inventario                                        [Exportar]    │
│ Historial de entradas y salidas.                                               │
│ ────────────────────────────────────────────────────────────────────────────── │
│ [Item ▾ todos]  [Tipo ▾]  [Módulo ▾]  [Desde __/__/__]  [Hasta __/__/__]       │
│                                                                 563 movimientos │
│ ────────────────────────────────────────────────────────────────────────────── │
│ Fecha       │ Item            │ Tipo    │ Cant.   │ Valor u.  │ Origen     │...│
│ ────────────────────────────────────────────────────────────────────────────── │
│ 2026-04-17  │ ACEITE HIDRO    │ salida  │ 1 UN    │ $54.500   │ Mant #129  │...│
│ 2026-04-17  │ IRB 2016 KOYO   │ salida  │ 2 UN    │ $44.144   │ Mant #129  │...│
│ ...                                                                            │
└────────────────────────────────────────────────────────────────────────────────┘
```

- Filter row collapses on narrower widths but stays single-row on desktop.
- Módulo values today: `compras`, `mantenimiento`, `ot`, `mov_diario`, `ajustes`. Labels in Spanish UI.
- Columns: fecha, item (code + descripción), tipo, cantidad + unidad, valor_unitario, módulo + id_origen (linked when we own the target page — for now compras/mant/OT links are placeholders until their modules ship).
- Pagination: server-side cursor (50 per page). 563 rows today, but movements will grow faster than items.
- Export: downloads the current filter view as xlsx.

### 5.6 Import drawer (slice C)

Three-step wizard inside a Sheet (wizard is lighter than a multi-page flow).

```
Step 1 — Archivo
  Drop zone + file picker (.xlsx)
  Expected columns shown in a collapsible "Formato esperado"
  [Cancelar] [Siguiente]

Step 2 — Vista previa
  Parsed table (first 50 rows) with per-row badge:
    🟢 Nuevo       🟡 Actualizado       ⚪ Sin cambios        🔴 Inválido (motivo)
  Summary bar:   124 nuevos · 87 actualizados · 430 sin cambios · 3 inválidos
  [← Anterior] [Importar]   (disabled if any 🔴 + 'ignorar inválidos' unchecked)

Step 3 — Resultado
  ✓ 211 items creados/actualizados. 3 filas se ignoraron.
  [Descargar log]   [Cerrar]
```

- Modes: **upsert-by-codigo only**. No "reemplazar" / "truncate" equivalent — explicit design decision (§3).
- Minimum columns required: `codigo`, `descripcion`. Rest are optional and fill `null`/`""` where missing.
- Invalid row reasons surfaced: missing `codigo`, missing `descripcion`, duplicate `codigo` within the file, `stock_minimo` not numeric, `valor_unitario` not numeric.
- Commit runs in a single transaction; failure rolls back the whole import. Log download covers the rows that applied vs rejected.
- Stock is **not imported** — imports touch master data, never quantities. If the user needs to "import stock" they'll Export → edit → Import master → then post movements. We document this clearly in the format helper panel.
- Processing guardrail: file size ≤ 2 MB, rows ≤ 5,000. Above that, error message suggests splitting.

## 6. User flows

### 6.1 Pañolero registers a manual entrada

1. Pañolero searches `ACEITE HIDRO` → finds item → clicks kebab → `Registrar movimiento`.
2. Dialog opens with tipo=Entrada selected by default.
3. Fills cantidad=20, valor_unitario prefilled from current value, types motivo="Ingreso pendiente de facturar".
4. Clicks `Registrar`. Server Action runs inside a transaction: update `inventario.stock += 20`, recompute weighted-average `valor_unitario`, insert movement.
5. Toast: `Movimiento registrado.` Dialog closes. Drawer (if open) or row updates with new stock.
6. On any error: toast + dialog stays open with form preserved.

### 6.2 Admin creates a new item

1. Admin clicks `+ Nuevo`.
2. Item Sheet opens empty. Código focused.
3. Fills código, descripción, optionally categoría/localidad/UP/unidad/stock_minimo/valor_unitario.
4. `Guardar`. Server Action: trim strings, validate zod, `prisma.inventario.create`.
5. On success: sheet closes, item appears in list (default sort by descripción), toast.
6. On duplicate código: inline field error on código + toast.

### 6.3 Pañolero watches alerts

1. Pañolero clicks `⚠ Bajo mínimo` toggle on `/inventario`.
2. List re-queries with `stock < stock_minimo AND stock_minimo > 0`.
3. Table now shows only low-stock items, sorted by deficit (most urgent first).
4. Pañolero opens each, reviews, may `Registrar movimiento` if stock was actually received but not logged.

### 6.4 Mecánico looks up stock (read-only)

1. Mecánico opens `/inventario`, types partial descripción.
2. Clicks a row → drawer opens with stock, last movements, and price.
3. No `Editar` / `Registrar movimiento` buttons visible.
4. Clicks `Ver historial` → scrolls through movements.

### 6.5 Admin imports an updated catalog

1. Admin clicks `Importar` → Drawer step 1.
2. Drops `inventario_update_2026_04.xlsx` → parsed, moves to step 2.
3. Preview shows 124 nuevos / 87 actualizados / 3 inválidos (bad stock_minimo). Uncheck-to-include inválidos is default unchecked.
4. Admin fixes file → re-imports, or ticks `Ignorar inválidos` and clicks `Importar`.
5. Commit runs, step 3 shows result + log download.
6. List page `revalidatePath` updates.

### 6.6 Admin tries to delete an item with movements

1. Admin opens row kebab → `Eliminar` (disabled, tooltip `Tiene movimientos asociados`).
2. Clicks anyway (the button is disabled — this path is unreachable; the safety valve is backend): Server Action double-checks dependencies and refuses.
3. If dependencies count is 0 (an orphan item mistakenly created): delete proceeds with ConfirmDialog.

### 6.7 User registers a salida that would go negative

1. Pañolero opens movement dialog, tipo=Salida.
2. Types cantidad=10 for an item with stock=7.
3. Warning banner appears inline: `⚠ Esta salida dejaría el stock en −3.`.
4. User can edit cantidad down, or click `Registrar` to accept the deficit anyway.
5. If confirmed, movement writes and stock becomes `−3` with red badge on the row.

## 7. Components

### 7.1 New shadcn primitives

Most already installed for listados. Phase 3 adds:

| Component | Why |
|---|---|
| `command` | Combobox base for categoría/UM autocomplete. |
| `popover` | Combobox + date-range picker. |
| `calendar` | Date-range filters on movements. |
| `tabs` | Detail drawer tabs. |
| `radio-group` | Tipo selector in movement dialog. |
| `textarea` | Observaciones. |
| `progress` | Import progress indication (if > 1s). |

### 7.2 Reusable domain components (owned by this spec)

Built here, reused by Compras, Mantenimiento, OT:

| Component | Path | Responsibility |
|---|---|---|
| `Combobox` | `components/app/combobox.tsx` | Autocomplete + create-new affordance. |
| `DateRangePicker` | `components/app/date-range-picker.tsx` | Two-month calendar popover. |
| `CurrencyInput` | `components/app/currency-input.tsx` | ARS-formatted numeric input. |
| `StockBadge` | `components/inventario/stock-badge.tsx` | Single source of truth for §5.1's decision table. |
| `MovementTable` | `components/inventario/movement-table.tsx` | Columns + empty state for both global and per-item movement lists. |
| `ItemDetailDrawer` | `components/inventario/item-detail-drawer.tsx` | Detail surface reused from list row clicks. |
| `ImportWizard` | `components/app/import-wizard.tsx` | 3-step wizard shell; body customized per entity. |
| `XlsxExportButton` | `components/app/xlsx-export-button.tsx` | Server-action-backed download trigger. |

### 7.3 Server Actions

Under `app/(app)/inventario/actions.ts`:

```ts
// Slice A
createItem(input)
updateItem(id, input)
deleteItem(id)                     // guards on dependencies
listCategorias()                   // distinct for filter dropdowns
listLocalidades()

// Slice B
registrarEntrada(itemId, input)    // runs in prisma.$transaction
registrarSalida(itemId, input)     // ditto
ajustarPrecio(itemId, input)       // ditto
listMovimientos(filters)           // cursor-paginated

// Slice C
exportarInventarioXlsx(filters)
importarInventarioXlsx(fileBuffer) // dry-run returns preview; commit runs a second call
exportarMovimientosXlsx(filters)
```

Common shell:

1. `await auth()` — reject if no session.
2. Role check via `lib/rbac.ts`. Writes → `requireAdmin` or `requirePañolero`; reads → `requireAuth`.
3. Zod-parse input; return field errors on failure.
4. Prisma op in try/catch; movement mutations always inside `prisma.$transaction`.
5. `revalidatePath("/inventario")` (+ `/inventario/movimientos` + `/inventario/[id]/...` as relevant).
6. Return `{ ok: true, data? }` or `{ ok: false, error, fieldErrors? }`.

### 7.4 Zod schemas

```ts
const itemSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  descripcion: z.string().trim().min(1).max(300),
  categoria: z.string().trim().max(100).optional(),
  localidad: z.string().trim().max(100).optional(),
  unidadProductiva: z.string().trim().max(100).optional(),
  unidadMedida: z.string().trim().max(50).optional(),
  stockMinimo: z.coerce.number().nonnegative().default(0),
  valorUnitario: z.coerce.number().nonnegative().default(0),
});

const entradaSchema = z.object({
  cantidad: z.coerce.number().positive(),
  valorUnitario: z.coerce.number().nonnegative(),
  motivo: z.string().trim().min(1).max(300),
  observaciones: z.string().trim().max(500).optional(),
});

const salidaSchema = z.object({
  cantidad: z.coerce.number().positive(),
  motivo: z.string().trim().min(1).max(300),
  observaciones: z.string().trim().max(500).optional(),
});

const ajustePrecioSchema = z.object({
  nuevoValor: z.coerce.number().nonnegative(),
  motivo: z.string().trim().min(1).max(300),
});
```

## 8. Data model touch

| Slice | Read | Write |
|---|---|---|
| A | `inventario`, `Usuario.count({rolId})` for audit actor, `Localidad`, `UnidadProductiva`, `UnidadMedida` (autocomplete sources), `inventario_movimientos.count` (for delete guard) | `inventario` |
| B | `inventario`, `inventario_movimientos` | `inventario`, `inventario_movimientos`, `precios_historico` (on ajuste de precio) |
| C | `inventario` | `inventario` (bulk) |

**Precios historico:** slice B's `ajustarPrecio` writes a new row `{ inventarioId, fechaCambio: now, valorAnterior, valorNuevo, origen: 'ajuste_manual', usuario }` so the price timeline (a Phase 7 view) has continuous data. Keep this pattern ready for Phase 5 where facturas will insert origen=`factura` rows.

**Weighted-average cost formula:**

```
old_total = stock_before * valor_unitario_before
new_total = old_total + cantidad * valor_unitario_entrada
stock_after = stock_before + cantidad
valor_unitario_after = stock_after > 0 ? new_total / stock_after : valor_unitario_entrada
```

Rounding: `valor_unitario` is stored as `double precision` (legacy parity — not `Decimal`). Round to 4 decimals at write to avoid IEEE-754 noise in comparisons (`Math.round(v * 10_000) / 10_000`); render rounded to 2 decimals in the ARS formatter. Budget for a Phase 7 migration to `Decimal(18, 4)` if management reporting shows meaningful drift.

## 9. States & edge cases

| State | Behavior |
|---|---|
| Empty DB | Empty-state card with CTA (admin) or neutral message (non-admin). |
| Loading list | Skeleton rows (10). |
| 0 search results | `No hay resultados para "xyz". Limpiá los filtros.` |
| Filter `Bajo mínimo` active, no matches | `Nada bajo mínimo ahora mismo. 👌` — positive message, not "empty". |
| Item has no movements | Detail drawer tab 2 shows empty-state `No hay movimientos registrados.` |
| Item with negative stock | Red badge + tooltip. Detail drawer header shows red "Stock negativo" strip. |
| Duplicate `codigo` on create/update | Toast + field-level error on `codigo`. |
| Salida > stock | Warning, not block. Confirm required. |
| Salida on item with `valor_unitario = 0` | Allowed; movement records $0 valor. |
| Entrada with `valor_unitario = 0` on a non-zero-price item | Allowed but warns: `Entrada sin valor: el precio promedio disminuirá.` |
| Ajuste de precio to same current value | Reject with inline error: `El valor es igual al actual.` |
| Concurrent edit of same item | Last-write-wins (Phase 2 pattern). Not optimistic locking — the transaction boundary on movements is the critical one. |
| Concurrent movements on same item | Serialized inside `prisma.$transaction` + `SELECT ... FOR UPDATE` on the item row (Postgres handles the lock). |
| Network failure on save | Toast `No se pudo registrar el movimiento. Reintentá.` Form preserved. |
| Import file with 0 valid rows | Shows step-2 with 0 green badges; commit button stays disabled. |
| Import file exceeds 5,000 rows / 2 MB | Step-1 rejects with message. |
| Import file with duplicate `codigo` inside the file | Row-level invalid badge on the later occurrence; earlier wins. |
| Role = non-admin, non-pañolero hits movement dialog route | UI never exposes the button; Server Action returns `forbidden`. |
| Pañolero tries to edit item master | `Editar` button hidden; Server Action for `updateItem` returns `forbidden`. |
| Search string with accents | Postgres `unaccent()` on indexed expression; behaves like listados. |
| Very long descripción | Truncate in table with tooltip; drawer shows full. |
| Legacy row with empty-string `unidadMedida` | Display as `—` in table. Form lets user fill it. |

## 10. i18n keys

Namespace `inventario.*`:

```
inventario.titulo                       "Inventario"
inventario.descripcion                  "Catálogo de insumos, repuestos y consumibles."
inventario.nuevoItem                    "Nuevo item"
inventario.editarItem                   "Editar item"
inventario.campos.codigo                "Código"
inventario.campos.descripcion           "Descripción"
inventario.campos.categoria             "Categoría"
inventario.campos.localidad             "Localidad"
inventario.campos.unidadProductiva      "Unidad productiva"
inventario.campos.unidadMedida          "Unidad de medida"
inventario.campos.stock                 "Stock"
inventario.campos.stockMinimo           "Stock mínimo"
inventario.campos.valorUnitario         "Valor unitario"
inventario.campos.valorTotal            "Valor total"
inventario.filtros.bajoMinimo           "Bajo mínimo"
inventario.filtros.placeholder          "Buscar código o descripción…"
inventario.stock.negativo               "Stock negativo — revisar"
inventario.stock.ok                     "Sin alertas"
inventario.stock.ningunoBajoMinimo      "Nada bajo mínimo ahora mismo."
inventario.detalle.ultimosMovimientos   "Últimos movimientos"
inventario.detalle.verTodo              "Ver todo el historial"
inventario.detalle.facturasProximamente "Facturas (próximamente)"
inventario.movimientos.titulo           "Movimientos de inventario"
inventario.movimientos.descripcion      "Historial de entradas y salidas."
inventario.movimientos.tipo             "Tipo"
inventario.movimientos.tipoEntrada      "Entrada"
inventario.movimientos.tipoSalida       "Salida"
inventario.movimientos.tipoAjuste       "Ajuste de precio"
inventario.movimientos.modulo           "Módulo"
inventario.movimientos.moduloCompras    "Compras"
inventario.movimientos.moduloMant       "Mantenimiento"
inventario.movimientos.moduloOt         "Órdenes de trabajo"
inventario.movimientos.moduloManual     "Movimiento manual"
inventario.movimientos.moduloAjuste     "Ajuste"
inventario.movimientos.motivo           "Motivo"
inventario.movimientos.observaciones    "Observaciones"
inventario.movimientos.registrar        "Registrar movimiento"
inventario.movimientos.registrado       "Movimiento registrado."
inventario.movimientos.confirmNegativo  "Esta salida dejaría el stock en {resultado}. ¿Confirmás?"
inventario.movimientos.entradaCeroAviso "Entrada sin valor: el precio promedio disminuirá."
inventario.import.titulo                "Importar desde Excel"
inventario.import.paso1                 "Archivo"
inventario.import.paso2                 "Vista previa"
inventario.import.paso3                 "Resultado"
inventario.import.formatoEsperado       "Formato esperado"
inventario.import.columnasMinimas       "Columnas obligatorias: código, descripción"
inventario.import.nuevos                "{count} nuevos"
inventario.import.actualizados          "{count} actualizados"
inventario.import.sinCambios            "{count} sin cambios"
inventario.import.invalidos             "{count} inválidos"
inventario.import.ignorarInvalidos      "Ignorar filas inválidas"
inventario.import.resultado             "{count} items creados/actualizados."
inventario.import.limiteArchivo         "Archivo demasiado grande (máx 2 MB o 5.000 filas)."
inventario.export.boton                 "Exportar"
inventario.eliminar.bloqueadoMovs       "No se puede eliminar: tiene {count} movimientos."
inventario.eliminar.bloqueadoUso        "No se puede eliminar: está en uso en {modulo}."
```

## 11. Nav + routing

- Sidebar `Inventario` entry (already placeholder from Phase 0) → `/inventario`.
- Sub-routes:
  - `/inventario` — list page.
  - `/inventario/movimientos` — global movement history.
  - `/inventario/[id]` — item detail page (same surface as drawer, but deep-linkable; drawer is the primary UX, page is the fallback for direct links from other modules in later phases).
  - `/inventario/[id]/movimientos` — per-item movement history (reached from drawer `Ver todo el historial`).
- Breadcrumbs: `Inventario / {descripcion}` on detail pages.
- Sidebar badge: count of items below minimum (server-computed, cached 60s). Red dot + number. Click goes to list with the `Bajo mínimo` filter pre-applied.

## 12. Role-based access

| Role | List | Item detail | Item create/edit | Delete | Movement | Import | Export |
|---|---|---|---|---|---|---|---|
| Administrador | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pañolero | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Mecánico | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Otros | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |

Enforcement same as listados: Server Action is the real gate, UI hides what isn't available.

Helper addition: `lib/rbac.ts` gains `requirePañolero(session)` which accepts Pañolero OR Administrador (strict-greater RBAC).

## 13. Acceptance checklist

### Per slice

- [ ] Spec deviations documented back into this file.
- [ ] Prisma migrations applied cleanly.
- [ ] `pnpm db:migrate-legacy` re-run end-to-end clean with the schema change.
- [ ] `pnpm typecheck` + `pnpm lint` clean.
- [ ] Admin + Pañolero + Mecánico walkthrough on a real sample of items.
- [ ] Non-authorized Server Actions return `forbidden` when called directly.
- [ ] i18n: no missing-key warnings; all keys under `inventario.*`.
- [ ] Stock badge decision table (§5.1) renders identically in list, drawer, and detail page.
- [ ] Playwright smoke: create item → register entrada → register salida → see updated stock → see history.

### After slice D (module done)

- [ ] Item master parity with legacy (row count, field coverage) verified against a fresh `flota7.db` dump.
- [ ] Movement insert under load: 20 concurrent `registrarSalida` on the same item land in a consistent final stock (test via a small script).
- [ ] Import wizard round-trip: export, edit a row, import → no duplicates, correct update.
- [ ] Stakeholder screenshot review before Phase 4 kick-off.

## 14. Out of scope

- Dashboards / analytics — Phase 7.
- Invoices on an item — Phase 5 writes them; tab stub only here.
- Physical count / toma de inventario — not in v1.
- Barcode scanning / mobile optimization — not in v1.
- Multi-warehouse split inventory model (one item → many locations) — legacy doesn't split this way; inventory is per-row with `localidad` text.
- Reserved / committed stock (open requisiciones that haven't received) — Phase 5 introduces requisiciones; nothing to reserve yet.
- Batch / serial tracking — never existed in legacy.
- Unit conversion (LITROS vs BIDONES) — not in legacy; flagged as a future ask if users want it.
- Price history visualization — Phase 7 (Estadísticas) will build it from `precios_historico`; this module just writes rows.

## 15. Build order

Pre-work (before PR #1):

1. Schema migration: audit columns on `Inventario` (`createdAt`, `updatedAt`, `createdById`), `createdById` on `InventarioMovimiento`, composite indexes listed in §4, `unaccent` expression index on `inventario.descripcion`.
2. Install new shadcn primitives (`command`, `popover`, `calendar`, `tabs`, `radio-group`, `textarea`, `progress`).
3. Build reusable components (`Combobox`, `DateRangePicker`, `CurrencyInput`, `StockBadge`, `MovementTable`, `ItemDetailDrawer`).
4. Extend `lib/rbac.ts`: add `PANOLERO_ROL = "Pañolero"` constant, `isPañolero(session)`, and `requirePañolero(session)` (accepts Pañolero OR Administrador). Role already exists in legacy `roles` table (id=6, 2 usuarios assigned) — no seed needed.
5. Sidebar badge for low-stock count.

Slice A (PR #1): item list + filters + edit Sheet + detail drawer read-only tabs + delete guard. No movements yet.

Slice B (PR #2): movement dialog (three tipos) + per-item history + global movements page + weighted-average logic + precios_historico writes.

Slice C (PR #3): Excel export (full + filtered) + Import wizard (dry-run preview + commit) + invalid-row reporting.

Slice D (PR #4): cleanup pass + trim-whitespace script + stakeholder walkthrough.
