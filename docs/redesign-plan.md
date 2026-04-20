# Redesign Plan — Pre-Cervi Visual Refresh

**Source:** Claude Design handoff bundles.
- Bundle 1 extracted at `/tmp/design-package/agimav/` (`shared.css`, `shared.js`, 8 prototype HTMLs).
- Bundle 2 extracted at `/tmp/design-package-2/agimav/` (same `shared.css`/`shared.js`, 5 additional HTMLs covering the previously-missing flows + a shared states reference).
**Audience:** the agent or human picking up this work.
**Goal:** ship the new visual system before Cervi's first look, without regressing any of the Phase 0–7 functionality already in main.
**Non-goal:** new features. The redesign is visual + small interaction polish; no schema, RBAC, or workflow changes.

---

## 0. How to read this doc

- §1 Inventory — what exists, what's net-new.
- §2 Foundation work (tokens, theme attrs, density/accent) — must land first; everything depends on it.
- §3 Shell (sidebar + topbar + tweaks panel + toast).
- §4 Component primitives the pages reuse (KPI strip, toolbar, data-table styling, drawer pattern, chart cards, kanban card, week calendar, OC chip+progress, catalog card).
- §5 Per-page implementation, in dependency order.
- §6 Gaps — pages/sub-routes the design doesn't cover, plus open product questions to confirm before building.
- §7 Sequencing + checkpoints.

When in doubt about scope, prefer **landing the design on the 8 covered pages cleanly** over half-applying it to unspecified sub-routes. Sub-routes can inherit tokens for free; their layouts can wait for a follow-up pass.

---

## 1. Inventory

### 1.1 What the design ships

**Bundle 1** — 8 prototype HTML files under `/tmp/design-package/agimav/project/`:

| Prototype | Maps to current route | Notes |
|---|---|---|
| `inventario.html` | `app/(app)/inventario/` | Built **first** as standalone (inlines shared.css). Most complete reference. |
| `maquinaria.html` | `app/(app)/maquinaria/` | Cards-or-table toggle. |
| `compras.html` | `app/(app)/compras/oc/` (closest match) | OC list only. Drawer links out to recepción + factura flows (Bundle 2). |
| `mantenimiento.html` | `app/(app)/mantenimiento/` | 4-lane kanban or list. "Nueva OT" links to `mantenimiento-nuevo.html` (Bundle 2). |
| `ordenes.html` | `app/(app)/ordenes-trabajo/` | Week calendar. OT form/detail inherit from mantenimiento patterns (Bundle 2). |
| `estadisticas.html` | `app/(app)/estadisticas/` | Dashboard only — no sub-tabs. |
| `listados.html` | `app/(app)/listados/` | Catalog index with 7 tiles. |
| `listados-proveedores.html` | `app/(app)/listados/proveedores/` | Detail catalog with form sheet — pattern for the other 6 listados. |

**Bundle 2** — 5 additional prototype HTMLs under `/tmp/design-package-2/agimav/project/`:

| Prototype | Maps to current route | Notes |
|---|---|---|
| `states.html` | *none — documentation page* | Reference for `<EmptyState>`, `<Skeleton>`, `<ErrorState>` variants. Used by dev to implement the shared set, not shipped as a route. |
| `mantenimiento-nuevo.html` | `app/(app)/mantenimiento/nuevo/` | Full-page OT create form + sticky right-side resumen sidebar. Layout Option 1 per user. |
| `mantenimiento-detalle.html` | `app/(app)/mantenimiento/[id]/` | Full-page OT detail with all 9 blocks (hero + status meter, datos generales KV, descripción, checklist with progress, repuestos table, partes de trabajo, bitácora timeline + note composer, archivos, facturas). |
| `recepcion.html` | `app/(app)/compras/oc/[id]/recepciones/nueva/` (new route) | Full-page receive-N-of-M with row-status coloring (ok/partial/short/pending), qty stepper, preset buttons, bulk bar, progress ring sidebar. |
| `factura.html` | `app/(app)/compras/oc/[id]/facturas/nueva/` (new route) | Full-page invoice entry with type segmented (A/B/C/X), OC match banner (ok/warn when precio≠OC), line-diff highlighting, totals sidebar. |

Both bundles share **identical** `shared.css` (344 lines) and `shared.js` (211 lines) — no foundation changes between bundles. Diffs to Bundle 1 HTMLs are purely link additions (`mantenimiento.html` "Nueva OT" button → anchor to `mantenimiento-nuevo.html`; `compras.html` drawer buttons → anchors to `recepcion.html` / `factura.html`).

### 1.2 What we already have we'll reuse

- **shadcn primitives** (`components/ui/`): `dialog`, `sheet`, `tabs`, `dropdown-menu`, `popover`, `progress`, `select`, `tooltip`, `sonner`. The drawer in `shared.css` maps to **Sheet (side="right")** + custom inner layout.
- **App composites** (`components/app/`): `breadcrumbs`, `data-table`, `form-sheet`, `actions-menu`, `audit-meta`, `combobox`, `currency-input`, `confirm-dialog`. Keep — restyle via tokens, not rewrites.
- **Stats charts** (`components/stats/`): `abc-pie`, `bar-chart`, `spark-line`, `price-chart`, `kpi-card`, `range-select`, `abc-badge`. Hand-rolled SVG; per AGENTS.md don't pull in Recharts. Three new chart shapes are needed (see §4.6).
- **Fonts:** Geist + Geist Mono already wired via `next/font`. No work.

### 1.3 What's net-new

- **Design tokens** for accent (sky/amber/violet), success/info, weak variants, muted-2, border-strong, subtle-foreground, density.
- **Tweaks panel** + localStorage persistence (`agimav.accent`, `agimav.density`, `agimav.theme`).
- **Sectioned sidebar** (Operación / Análisis / Datos maestros) + footer with avatar + sign-out.
- **Topbar additions:** global search trigger (⌘K), tweaks button, notifications bell, icon-button styling.
- **Drawer-with-tabs pattern** (Sheet wrapper that always renders a tabs strip + content).
- **KPI strip with variants** (`--warn`, `--danger`, `--ok`, `--info`).
- **Stock decision chip** (negative/low/zero/ok) — already in `docs/ux-spec/2-inventario.md` §5.1.
- **OC estado chip + progress%** map.
- **Mantenimiento kanban card** (priority dot, due-date badge, progress bar for `en_curso`).
- **Week calendar grid** (L-D × 8-18h, absolute-positioned events colored by tipo).
- **Catalog tile** (icon + count + meta + chevron) for listados index.
- **Three new chart shapes**: heatmap (5×12), stacked bars, ranked list with mini-bars. Donut is already in `abc-pie` — extract a generic `Donut`.
- **Shared states set** (from Bundle 2 `states.html`): `<EmptyState>` with 3 variants (no-results / no-data / empty-tab) + `<InlineState>`; `<Skeleton>` primitives (text/title/chip/avatar/box + line-40/60/80/100) + 4 composed patterns (TableRows, CardGrid, KPIStrip, Detail); `<ErrorState>` with 3 variants (server / forbidden / offline) + `<InlineError>`. Skeletons use shimmer via `@keyframes sk-shimmer`.
- **OT form primitives** (from Bundle 2 `mantenimiento-nuevo.html`): numbered section card (`form-card` with `.num` bubble + `.opt` hint), type chooser card grid (with radio-card selection + check badge), priority segmented (baja/media/alta with colored dots), machine chip preview, repuestos inline editor (SKU/item/stock/qty/subtotal table with add-row picker + hint banner), sticky resumen sidebar with cost breakdown.
- **OT detail primitives** (from Bundle 2 `mantenimiento-detalle.html`): hero strip (id tag + tipo chip + priority pill + status pill), horizontal status-meter stepper (5 steps: Creada → Asignada → Iniciada → Completada → Cerrada with done/current/future states), KV grid for datos generales, checklist rows with progress bar footer, parte-de-trabajo row layout, bitácora timeline with 5 event types (create/status/note/stock/file), note composer, files grid + upload tile.
- **Recepción primitives** (from Bundle 2 `recepcion.html`): PO summary strip, row-status table (ok/partial/short/pending tinted rows), qty stepper input, preset buttons ("Recibir todo", "Marcar parcial"), inline notes cell, bulk bar (appears on selection), progress ring (SVG 64px), attach-file dashed box.
- **Factura primitives** (from Bundle 2 `factura.html`): invoice header (type segmented A/B/C/X + nº field + proveedor chip picker + fecha), OC match banner (success green / warn amber when line differs), line-diff row highlighting (amber tint on `data-diff="true"`), IVA picker per line, linked-OC chip, totals sidebar (neto/IVA/percepciones/total).

---

## 2. Foundation: tokens + theme attrs

### 2.1 Add to `app/globals.css`

Current `globals.css` has `--background`, `--foreground`, `--card`, `--muted`, `--primary`, `--destructive`, `--accent`, `--chart-1..5`, `--sidebar-*`, `--radius`, and uses `.dark` class.

**Add (alongside existing tokens):**

```css
:root {
  /* Brand accents (switchable via [data-accent]) */
  --accent-sky:    oklch(0.62 0.14 240);
  --accent-amber:  oklch(0.78 0.15 75);
  --accent-violet: oklch(0.58 0.18 295);

  /* Default accent → sky */
  --brand:      var(--accent-sky);
  --brand-weak: color-mix(in oklch, var(--brand) 14%, var(--card));

  /* Status */
  --success:      oklch(0.68 0.14 150);
  --success-weak: color-mix(in oklch, var(--success) 14%, var(--card));
  --warn:         oklch(0.78 0.15 75);
  --warn-weak:    color-mix(in oklch, var(--warn) 14%, var(--card));
  --danger:       oklch(0.62 0.20 25);
  --danger-weak:  color-mix(in oklch, var(--danger) 14%, var(--card));
  --info:         oklch(0.62 0.14 240);
  --info-weak:    color-mix(in oklch, var(--info) 14%, var(--card));

  /* Neutrals */
  --muted-2:            oklch(0.97 0 0);
  --subtle-foreground:  oklch(0.55 0.02 250);
  --border-strong:      oklch(0.86 0.01 250);

  /* Density (row height + paddings) */
  --row-h: 44px;
  --pad-x: 14px;
  --pad-y: 10px;
}

[data-accent="amber"]  { --brand: var(--accent-amber); }
[data-accent="violet"] { --brand: var(--accent-violet); }

[data-density="compact"]      { --row-h: 36px; --pad-x: 10px; --pad-y: 6px; }
[data-density="comfortable"]  { --row-h: 52px; --pad-x: 18px; --pad-y: 14px; }
```

**Dark mode:** keep the existing `.dark` class **plus** add `[data-theme="dark"]` as an alias so the tweaks panel can toggle via attribute. Either:

- **Option A (preferred):** make the tweaks switch toggle the `.dark` class on `<html>` and persist; keep all current selectors. One source of truth.
- **Option B:** add `:root[data-theme="dark"], .dark { ... }` on every dark override. More invasive.

Pick Option A. Update `shared.js` patterns to write `.dark` class instead of `data-theme`.

### 2.2 Tailwind utility coverage

Tailwind v4 reads `--color-*` automatically. Map the new tokens in `app/globals.css` `@theme` block:

```
--color-brand: var(--brand);
--color-brand-weak: var(--brand-weak);
--color-success / -weak, --color-warn / -weak, --color-danger / -weak, --color-info / -weak
--color-muted-2, --color-subtle-foreground, --color-border-strong
```

This unlocks `bg-brand`, `text-warn`, `border-border-strong`, etc., without raw oklch in JSX.

### 2.3 Density application

Use `--row-h`/`--pad-x`/`--pad-y` inside `data-table.tsx`, `kpi-card.tsx`, and form rows. Don't sprinkle `style=` — define utility classes (`.row-h`, `.row-pad`) in `globals.css` that read the vars.

---

## 3. Shell

### 3.1 Sidebar (`components/app/sidebar.tsx`)

Current: flat 7-item list, `w-60`, brand on top, no footer.

**Changes:**

1. Restructure `lib/nav.ts` into sections matching `shared.js` `NAV`:
   ```
   Operación: maquinaria, inventario, compras, mantenimiento, ordenes-trabajo
   Análisis: estadisticas
   Datos maestros: listados
   ```
2. Render section headers (`uppercase tracking-wide text-xs text-subtle-foreground`).
3. Active state = thick left bar in `--brand` + bg `--brand-weak` (matches `.nav-item[data-active]` in shared.css).
4. Footer block: avatar (initials from session), name, role (`Administrador` if `isAdmin(session)` else `Usuario`), sign-out icon button.
5. Keep `bajoMinimo` badge on Inventario; **drop** the hardcoded compras=3 badge from the design until we wire a real query (see §6).
6. Width stays `w-60` (240px) to match design.

### 3.2 Topbar (`components/app/topbar.tsx`)

Current: breadcrumbs + user dropdown. h-14.

**Changes:**

1. Center: global search trigger pill (matches `.search-global`) — open existing `Command` (cmdk) dialog on click or ⌘K. Wire to a single global search action that routes by entity prefix (defer real search index — see §6).
2. Right: tweaks button (gear icon, opens panel from §3.3), notifications bell (placeholder, no popover content yet), then existing user menu.
3. Move breadcrumbs into the new `.breadcrumbs` styling (parent label muted, separator chevron, current strong).

### 3.3 Tweaks panel (new: `components/app/tweaks-panel.tsx`)

Floating panel anchored top-right, slide-in.

**For Cervi v1 (per Q4 resolution):** only the **Tema oscuro** switch is visible. Accent swatches and density segmented are rendered but conditionally hidden based on `process.env.NEXT_PUBLIC_TWEAKS_ADVANCED === "1"`. Build them fully — gating is UI-only.

- State persists to `localStorage`: `agimav.accent`, `agimav.density`, `agimav.theme`.
- On mount, hydrate `<html>` with `data-accent`, `data-density`, and toggle `.dark` (all three — even when UI doesn't expose accent/density, persisted values still apply).
- Rol simulator from the inventario prototype — **don't ship** (per Q5). Real RBAC already exists via `lib/rbac.ts`; a fake role swap is misleading on a live app.

### 3.4 Toast

Already have `sonner`. No new toast component — restyle to match `shared.css` `.toast` (rounded, dark bg, check icon).

---

## 4. Component primitives

Every page leans on these. Build once before doing pages.

### 4.1 KPI strip + KPI card variants

Extend `components/stats/kpi-card.tsx` with a `tone` prop: `"neutral" | "warn" | "danger" | "ok" | "info"`. Tone maps to `--warn-weak` / `--danger-weak` etc. background + colored value text. KPI strip is a `grid grid-cols-4 gap-3` (responsive: `md:grid-cols-2 lg:grid-cols-4`).

### 4.2 Toolbar (new: `components/app/toolbar.tsx`)

Pattern: search input (left, grows), zero-or-more selects, zero-or-more pill toggles, view-mode segmented control on the right. Replaces the ad-hoc filter rows in inventario, maquinaria, compras, listados-proveedores.

### 4.3 Data table styling

`components/app/data-table.tsx` exists. Restyle:

- Header: sticky, `bg-muted-2`, `text-subtle-foreground`, `font-medium text-xs uppercase tracking-wide`.
- Rows: hover `bg-muted-2/60`, divider via `border-b border-border`.
- Row kebab → `actions-menu.tsx` already handles.
- Density vars from §2.3.

### 4.4 Drawer-with-tabs (new: `components/app/detail-drawer.tsx`)

Wrap shadcn `Sheet` (`side="right"`, `w-[480px]` desktop, full-width mobile). Children:
- Header: title + subtitle + close button.
- Tabs strip (uses shadcn `Tabs`).
- Scrollable content area.
- Optional footer action row.

Used by inventario, maquinaria, compras, mantenimiento. Each module passes its own tab definitions + panels; the drawer doesn't know about domain shapes.

### 4.5 Status chip (new: `components/app/status-chip.tsx`)

Single component, takes `tone: "neutral" | "ok" | "warn" | "danger" | "info"` and `label`. Optional `dot` prop for the colored leading circle. Replaces the chip styles inlined across prototypes.

For OC estado specifically, add a `components/compras/oc-status.tsx` that wraps `StatusChip` + `Progress` and encodes the `ESTADO_MAP` from `compras.html`.

### 4.6 Charts — three new shapes

In `components/stats/`:

- `donut.tsx` — generalize `abc-pie.tsx` to take `{ label, value, color? }[]`. Used by Mezcla OT card.
- `horizontal-bars.tsx` — list of labeled rows with bar fill + value. Used by Backlog por máquina, OTIF, Productividad técnicos, Repuestos consumidos (the last with mini-bar variant).
- `stacked-bars.tsx` — vertical stacked bars per period, with legend. Used by Gasto por rubro.
- `heatmap.tsx` — N×M grid, cell color from value scale. Used by Horas parada (5 días × 12 h).

Keep `spark-line.tsx`, `bar-chart.tsx`, `price-chart.tsx`, `abc-pie.tsx` as-is (used in current pages).

### 4.7 Kanban card (new: `components/mantenimiento/kanban-card.tsx`)

Priority dot, title, máquina, due-date badge (color from `serviceHealth` helper port from `maquinaria.html`), progress bar for `en_curso`. Lane container is a plain `div` with header + scroll area; not worth abstracting until lanes diverge.

### 4.8 Week calendar (new: `components/ordenes/week-calendar.tsx`)

L-D columns, hours 8-18 rows (48px each), header row 32px. Events absolutely positioned: `top = 32 + (s-8)*48`, `height = dur*48 - 4`. Color by `tipo` (mant/inv/comp/log/ins). Click → open detail. Mini-month nav and filter sidebar live next to it (`grid grid-cols-[220px_1fr_220px]`).

This is the largest net-new component. Keep it dumb — events come from server, no drag/drop yet.

### 4.9 Catalog tile (new: `components/listados/catalog-tile.tsx`)

Icon (lucide), count (large), label, meta line, chevron on hover. Used 7× on listados index. Group container is a `section` with a `<h2>` header.

### 4.10 Shared states set (new: `components/app/states/`)

Reference: Bundle 2 `states.html`. Ship as one module so all pages can pick the right variant.

- `empty-state.tsx` — props `{ variant: "no-results" | "no-data" | "empty-tab"; icon?: ReactNode; title: string; description?: ReactNode; actions?: ReactNode }`. 56px icon wrap on `bg-muted`, centered layout, max-width 420px.
- `inline-state.tsx` — for cells/small zones. Monospace uppercase "— · sin datos · —" mark + optional description. No icon.
- `skeleton.tsx` — primitives: `<Skeleton.Text line={40|60|80|100} />`, `<Skeleton.Title />`, `<Skeleton.Chip />`, `<Skeleton.Avatar />`, `<Skeleton.Box />`. All use the shimmer animation (keyframes in `globals.css`).
- `skeleton-patterns.tsx` — composed: `<TableRowsSkeleton rows={n} />`, `<CardGridSkeleton cards={n} />`, `<KPIStripSkeleton />`, `<DetailPageSkeleton />`. Match the real grid proportions.
- `error-state.tsx` — props `{ variant: "server" | "forbidden" | "offline"; title: string; description?: ReactNode; trace?: string; actions?: ReactNode }`. 56px icon wrap; `server` uses `--destructive-weak`, `forbidden` uses `--muted`, `offline` uses `--warn-weak`. Optional `<pre>` for trace-id.
- `inline-error.tsx` — for partial-panel failures (drawer body, chart card). Inline banner on `--destructive-weak` with retry.

**Rule (from the prototype):** page-level failures use `<ErrorState>`; isolated block failures use `<InlineError>`. Skeletons must mimic the final grid, never a generic spinner (except transient button states like "Guardando…").

### 4.11 OT form primitives (new: `components/mantenimiento/form/`)

Used by the OT create page (§5.9).

- `form-card.tsx` — numbered section wrapper. Props: `{ step: number; title: string; hint?: string; children }`. Renders the `.num` bubble + head + body.
- `type-chooser.tsx` — radio-card grid. Takes `{ options: { value, title, description, icon }[]; value; onChange }`. Uses `data-selected` + accent-weak bg when selected.
- `priority-segmented.tsx` — 3-way with colored dots. Tone map: baja=muted-foreground, media=warn, alta=danger.
- `machine-chip.tsx` — selected machine preview + "Cambiar…" button. Opens a máquina picker (combobox).
- `repuestos-editor.tsx` — inline table with add-row picker. Each row: SKU / nombre / stock disponible / qty stepper / subtotal / remove. Emits `onChange(lines)`. Includes the reserved-not-consumed hint banner on `--info-weak`.
- `summary-sidebar.tsx` — sticky right column with resumen card + cost card (mano de obra + repuestos + total). Props accept the draft OT state.

### 4.12 OT detail primitives (new: `components/mantenimiento/detail/`)

Used by the OT detail page (§5.10).

- `ot-hero.tsx` — id tag + tipo chip + priority pill + status pill (clickable to change state) + title + sub + action buttons (Editar/Pausar/Marcar completada). Header strip.
- `status-meter.tsx` — horizontal stepper. Steps have `data-state="done" | "current" | "future" | "cancelled"`. Colored bar + check badge on done, brand-colored bar on current, red + strikethrough on cancelled. **Takes `steps` prop** (variant-agnostic). Two presets live in the module using it:
  - `MantenimientoStatusMeter` (3 steps + optional Chacra/Taller sub-chip on step 2)
  - `OtStatusMeter` (2 steps)
  - Design's 5-step version is **not** used — see §6.2 Q12 resolution.
- `kv-grid.tsx` — 4-column label/value grid for datos generales. Generic — reusable outside OT (e.g., máquina detail).
- `checklist.tsx` — rows with custom checkbox + label + meta. Footer progress bar with percentage.
- `partes-table.tsx` — técnico avatar + name + date + horas + task. Totals row.
- `timeline.tsx` — bitácora with 5 event types colored dots: create (info), status (brand), note (muted), stock (warn), file (violet). Each event: who + when + body with `<tag>` chips for entity refs. Note composer at bottom.
- `files-grid.tsx` — 4-column tile grid. Image tiles show diagonal hatch preview with IMG label; PDF tiles tint destructive-weak. Upload tile is dashed-border last slot.

### 4.13 Recepción primitives (new: `components/compras/recepcion/`)

Used by the recepción page (§5.11).

- `po-strip.tsx` — horizontal summary of the source OC (id, proveedor, fechas, nº remito) with action buttons.
- `receive-table.tsx` — the receive-N-of-M grid. Row states via `data-status`: `ok` (success-weak tint), `partial` (warn-weak), `short` (danger-weak), `pending` (no tint). Auto-derives status from `ped`/`prev`/`rec`.
- `qty-stepper.tsx` — compact +/- control with mono input + unit suffix. Standalone — also used by factura + repuestos editor if needed.
- `receive-bulk-bar.tsx` — appears above table when rows selected. Actions: "Recibir todo seleccionado", "Marcar como parcial", "Mover a otro depósito".
- `progress-ring.tsx` — SVG ring (64px) with percentage label + sub-label. Used in sidebar.
- `attach-box.tsx` — dashed-border file attach slot. Click opens file picker.

### 4.14 Factura primitives (new: `components/compras/factura/`)

Used by the factura page (§5.12).

- `invoice-header.tsx` — type segmented (A/B/C/X) + nº input (mono) + proveedor chip (cod avatar + nombre + CUIT) + fecha. Grid `140px 1fr 1fr 1fr`.
- `match-banner.tsx` — full-width strip atop the line table. Green success when all lines match OC, amber warn when any differ. Links to OC diff.
- `factura-lines-table.tsx` — line editor. Row-level `data-diff="true"` tints amber when qty or precio differ from OC. Shows `<DiffNote>` with the OC reference value.
- `iva-picker.tsx` — per-line IVA dropdown (21 / 10.5 / 27 / exento).
- `oc-link-chip.tsx` — pill linking back to source OC.
- `totals-sidebar.tsx` — neto / IVA breakdown by tasa / percepciones / total. Sticky right column.

---

## 5. Per-page implementation

Order matters: foundations first (§2), shell (§3), primitives (§4), then pages bottom-up by reuse. The order below is the recommended build order.

### 5.1 Listados index — `app/(app)/listados/page.tsx`

- Replace current grid with `CatalogTile` × 7, grouped: Organización (clientes, proveedores, categorías), Estructura operativa (sectores, depósitos, tipos-maquinaria), Unidades de medida (unidades).
- Counts from existing prisma queries (one `count` per model).
- Bottom audit-hint banner (link to changelog/audit log if available; otherwise stubbed).

### 5.2 Listados/proveedores — `app/(app)/listados/proveedores/page.tsx`

Reference for the other 6 catalogs.

- KPI strip: total, activos, IVA-exento count, top localidad.
- Toolbar: search + estado select + localidad select + IVA select.
- Table: columns from current proveedor schema; sortable; row actions Editar / Desactivar / Reactivar.
- Right `Sheet` form for create/edit (use existing `form-sheet.tsx`); CUIT regex validation already exists in proveedor schema — reuse.
- Keep the legacy id preservation rule from AGENTS.md.

### 5.3 Inventario — `app/(app)/inventario/page.tsx` + drawer

- Already covered by `docs/ux-spec/2-inventario.md` §5.1 stock decision table — port chip styles unchanged.
- KPI strip (4): total SKUs, bajo mínimo, valor inventario, top categoría.
- Toolbar: search + categoría + localidad + bajoMinimo pill + view toggle (table/cards — cards optional, defer if tight).
- DetailDrawer with tabs Resumen / Movimientos / Facturas (mark Facturas `próx.` and disable until backend wires it; matches design).
- Movement modal: tipo segmented (entrada/salida/ajuste), preview-bar showing delta, neg-warn when result < 0.
- Existing `inventario-client.tsx` orchestrates state; restyle, don't rewrite.

### 5.4 Maquinaria — `app/(app)/maquinaria/page.tsx` + drawer

- Cards-or-table toggle. Cards = `EquipCard` (icon by tipo, status chip, service health bar).
- KPI strip: operativas, en mantenimiento, fuera de servicio, próximas a service.
- DetailDrawer tabs: Resumen / Historial / Checklists / Documentos (last two stub if backend not ready — show empty state, don't fake data).
- Port `statusChip`, `serviceHealth`, `equipIcon` from `maquinaria.html` into `components/maquinaria/`.

### 5.5 Compras OC — `app/(app)/compras/oc/page.tsx` + drawer

- KPI strip: pendientes aprobación, en tránsito, recibidas mes, gasto mes.
- Table: numero, proveedor, fecha, estado (chip + progress), monto, actions.
- DetailDrawer tabs: Ítems / Recepciones / Facturas / Historial. Existing routes `compras/oc/[id]/recepciones`, `.../facturas` should redirect/link from the drawer or stay as separate pages — pick **drawer = read-only summary, separate pages = action flows**.
- `ESTADO_MAP` lives in a single source: `lib/compras/oc-estado.ts`.

**Out of design scope (keep current UI, just inherit tokens):** `compras/requisiciones`, `compras/recepciones`, `compras/facturas`. See §6.

### 5.6 Mantenimiento — `app/(app)/mantenimiento/page.tsx`

- Toggle kanban / list.
- Lanes: Vencidas, Próximas, En taller, Completadas. Filter logic from existing module.
- DetailDrawer with bitácora timeline (reuse audit-meta + a small Timeline component if needed).

**Out of design scope:** `mantenimiento/horometros`, `mantenimiento/plantillas`, `mantenimiento/nuevo`, `mantenimiento/[id]`. See §6.

### 5.7 Órdenes de trabajo — `app/(app)/ordenes-trabajo/page.tsx`

- WeekCalendar (§4.8) as main view.
- Mini-month + filter sidebars.
- Legend strip.
- Click event → navigate to existing `ordenes-trabajo/[id]` (don't build a new detail; existing one keeps working with new tokens).
- "Nueva OT" button → existing `ordenes-trabajo/nuevo`.

### 5.8 Estadísticas — `app/(app)/estadisticas/page.tsx`

Big bang page: 8 chart cards in a 12-col grid. Build order:

1. KPI strip (4 cards).
2. Mezcla OT (Donut — cheapest, validates donut component).
3. Repuestos consumidos (HorizontalBars mini variant).
4. Backlog por máquina (HorizontalBars).
5. Performance proveedores OTIF (HorizontalBars + objetivo line).
6. Productividad técnicos (HorizontalBars grouped).
7. Disponibilidad & hs taller (dual-axis — port from existing `bar-chart.tsx` + `spark-line.tsx`, compose).
8. Gasto por rubro (StackedBars).
9. Horas parada (Heatmap).

**Out of design scope:** `estadisticas/maquinaria`, `.../proveedores`, `.../abc`, `.../precios`. Keep them — the dashboard links to them.

### 5.9 Mantenimiento — nueva OT · `app/(app)/mantenimiento/nuevo/page.tsx`

Reference: Bundle 2 `mantenimiento-nuevo.html`. Layout: `grid-template-columns: 1fr 340px`, sticky right sidebar.

- Back link → `/mantenimiento`.
- PageHeader + "Desde plantilla" action button (opens a plantilla picker; guarded by plantilla existence per `docs/roadmap-remaining.md` — plantillas are barely used in legacy, so surface a disabled state when none exist).
- Form columns (5 numbered `FormCard` sections):
  1. **Máquina** — `MachineChip` + "Cambiar…" opens combobox over `/api/maquinaria`.
  2. **Tipo de trabajo** — `TypeChooser` with 3 options (preventivo/correctivo/mejora). If preventivo, show plantilla picker below.
  3. **Descripción** — título (required) + textarea.
  4. **Repuestos e insumos** — `RepuestosEditor`. Stock comes from `/api/inventario`. Hint banner about reserved-not-consumed.
  5. **Asignación** — técnico (required select), prioridad segmented, fecha+hora+duración grid, notas textarea.
- Right sidebar: `SummarySidebar` with live resumen + cost (mano de obra calculated from técnico rate × duración; repuestos sum).
- Sticky footer actions: "Cambios sin guardar" indicator + Cancelar / Guardar borrador / Crear OT buttons.
- On submit → POST creates OT, redirects to `/mantenimiento/{id}`.
- **Validation:** zod schema for the OT draft; required fields marked with `*`.
- **Reuse for `ordenes-trabajo/nuevo`:** same page, different default `tipo` + back-link. Parameterize the component if shape diverges.

### 5.10 Mantenimiento — OT detalle · `app/(app)/mantenimiento/[id]/page.tsx`

Reference: Bundle 2 `mantenimiento-detalle.html`. Layout: `grid-template-columns: 1fr 340px`.

- Back link + `OTHero`. Editable status pill → dropdown sourced from existing `lib/mantenimiento/estado.ts` `allowedTransitions(estado, { isAdmin })` (do not rebuild). For OT, the equivalent helper in `app/(app)/ordenes-trabajo/types.ts`.
- Status meter under hero (per Q12 resolution): `MantenimientoStatusMeter` (3 steps + Chacra/Taller sub-chip) on the mantenimiento route, `OtStatusMeter` (2 steps) on the OT route.
- Main column sections (server-fetched):
  - **Datos generales** — `KVGrid` (máquina, técnico, fechas, duración, ubicación, operador, origen-plantilla).
  - **Descripción** — read-only block (editable via Edit drawer).
  - **Checklist** — `Checklist` component. Each row toggleable if current user is the técnico or admin; emits optimistic updates. Progress bar footer.
  - **Repuestos e insumos** — table (SKU/item/qty/subtotal). Button "Consumir de pañol" → POSTs movement (existing `/api/inventario/movimientos` pipeline, transactional per AGENTS.md).
  - **Partes de trabajo** — `PartesTable`. "Cargar parte" button opens a sheet dialog for new entry.
  - **Facturas asociadas** — table or empty state (`<InlineState>` when none).
  - **Bitácora** — `Timeline` with note composer. Notes POST to `/api/ot/{id}/notes`.
  - **Archivos adjuntos** — `FilesGrid`. Upload via presigned URL (defer actual storage integration — see backlog).
- Right sidebar: máquina preview link + cost breakdown + resumen de horas.
- **Empty states:** partes, facturas, archivos each show an EmptyState when zero rows. Checklist shows EmptyState when no plantilla applied.
- **Reuse for `ordenes-trabajo/[id]`:** same page component, param-driven. OT vs mantenimiento sections are near-identical.

### 5.11 Recepción · `app/(app)/compras/oc/[id]/recepciones/nueva/page.tsx`

Reference: Bundle 2 `recepcion.html`. New route — current flow is in the `recepciones` sub-page; adjust per routing decision.

- Back link → OC detail.
- `POStrip` showing source OC (id, proveedor, fechas, nº remito).
- Main section: `ReceiveTable` — row per OC line. Columns: checkbox, SKU, item, pedido (ped), ya recibido (prev), recibir ahora (qty stepper), depósito destino, lote, estado badge, notas.
- Row status auto-derives (`rec===0` → short; `rec===ped` → ok; `rec>0 && rec<ped` → partial).
- Preset buttons on each row: "Recibir todo" / "Marcar faltante".
- `ReceiveBulkBar` appears when rows selected.
- Right sidebar: `ProgressRing` (% of OC received after this recepción) + totals + attach-files box + fecha/usuario inputs.
- Footer actions: summary chip (X de Y ítems, valor total) + Cancelar / Guardar borrador / Confirmar recepción.
- On confirm → POST transactional recepción + inventario movements (existing pipeline; do NOT split per AGENTS.md).
- **Reuse existing `components/compras/recepcion-form.tsx` logic** — just swap the UI layout.

### 5.12 Factura · `app/(app)/compras/oc/[id]/facturas/nueva/page.tsx`

Reference: Bundle 2 `factura.html`. New route parallel to recepción. Also reachable as standalone `/compras/facturas/nueva` with manual OC picker.

- Back link → OC detail (or `/compras/facturas` if standalone).
- `InvoiceHeader` — tipo segmented + nº (mono input) + proveedor chip picker + fecha + condición IVA badge.
- `MatchBanner` — green when all lines match OC; amber when any differ ("3 líneas con diferencia de precio"). Links to OC.
- `FacturaLinesTable` — editable. Columns: SKU, descripción, qty, unit, IVA picker, subtotal. Rows with `qty !== ocQty || unit !== ocPrecio` render `data-diff="true"` (amber tint + `DiffNote` beneath).
- Footer "Agregar ítem fuera de OC" row with picker.
- Right sidebar: totals breakdown (neto + IVA por tasa + percepciones + total) + `OCLinkChip` back to source + notas textarea.
- Footer actions: "Cambios sin guardar" + Cancelar / Guardar borrador / Registrar factura.
- On submit → POST transactional factura + link to OC (existing pipeline).
- **Tipo/IVA validation:** match the existing Phase 5 Slice E scope-swapped factura schema.

---

## 6. Gaps + open questions

### 6.1 Pages with no design — keep current UI, restyle via tokens only

Updated after Bundle 2 closed 4 of the previous gaps (OT create, OT detail, recepción, factura). Remaining list inherits tokens automatically once §2 lands. Don't rebuild layouts; if they look ugly under the new shell, file a follow-up rather than improvising.

- `compras/requisiciones`, `compras/recepciones` *(list view)*, `compras/facturas` *(list view)* — list UIs inherit tokens; the Bundle 2 `recepcion.html` + `factura.html` cover the create flows only.
- `mantenimiento/horometros`, `mantenimiento/plantillas` — apply the listados/proveedores table+sheet pattern when touched.
- `inventario/[id]`, `inventario/movimientos` — design implies these collapse into the drawer; **decide:** kill the routes, or keep as deep-links? Unchanged from prior question.
- `maquinaria/tipos`, `maquinaria/[tipoId]` — apply the listados catalog-tile + proveedores detail pattern when touched.
- `estadisticas/maquinaria`, `estadisticas/proveedores`, `estadisticas/abc`, `estadisticas/precios` — chart-card grid from §5.8 fits.
- All 6 listados sub-catalogs other than proveedores — apply the proveedores pattern (§5.2) once and clone.

**Now covered (no longer a gap):**
- ✅ `mantenimiento/nuevo` — Bundle 2 `mantenimiento-nuevo.html` → §5.9
- ✅ `mantenimiento/[id]` — Bundle 2 `mantenimiento-detalle.html` → §5.10
- ✅ `ordenes-trabajo/nuevo` — inherits §5.9 component (confirmed by user: "OT no hace falta diseño propio")
- ✅ `ordenes-trabajo/[id]` — inherits §5.10 component
- ✅ Recepción create flow — Bundle 2 `recepcion.html` → §5.11
- ✅ Factura create flow — Bundle 2 `factura.html` → §5.12
- ✅ Empty/loading/error states — Bundle 2 `states.html` → §4.10

### 6.2 Open product questions — confirm before building

1. ✅ **Sidebar badges — RESOLVED.** Inventario = `bajoMinimo` (existing query). Compras = OC in `Emitida` state with no recepción yet ("awaiting delivery"). Legacy shows 4 such rows. Implementation: new query in `lib/compras/pending-badge.ts` returning count of `ordenes_compra.estado = 'Emitida'` that have no matching `recepciones` row.
2. ✅ **Global search — RESOLVED.** Render the pill; click opens empty cmdk dialog with single "Próximamente · la búsqueda global estará disponible pronto" item. No backend for v1.
3. ✅ **Notifications bell — RESOLVED.** Render disabled with tooltip "Próximamente". Keeps visual mass at zero impl cost.
4. ✅ **Tweaks panel — RESOLVED (option c).** Ship the panel with **only the dark-mode toggle visible** for Cervi v1. Accent swatches and density segmented are built but gated behind an env var / feature flag (e.g., `NEXT_PUBLIC_TWEAKS_ADVANCED=1`) so internal demos can still show them. Tokens from §2 still land fully — the gating is purely UI exposure.
5. **Rol simulator** in inventario prototype — **drop**. Misleading on a real RBAC app.
6. **Dark mode.** Currently `.dark` class. **Recommend:** keep `.dark`, have tweaks panel toggle it. Don't migrate to `[data-theme]`.
7. **Facturas tab inside inventario drawer.** Design marks `próx.` Confirm: ship disabled tab now, fill in Phase 9? Or just hide the tab.
8. **Listados sub-catalogs** beyond proveedores — apply pattern to all 6 in scope, or only proveedores+clientes+categorías now and others later? Confirm.
9. **Responsive.** Design is 1440px+. Cervi user is desktop-only per Phase 0 assumptions, so mobile = future. Confirm we can drop responsive work entirely for v1.
10. ~~**Empty / loading / error states**~~ — **resolved.** Bundle 2 `states.html` defines the full set; see §4.10.
11. **Recepción / Factura route placement.** Bundle 2 flows imply dedicated routes (`compras/oc/[id]/recepciones/nueva`, `.../facturas/nueva`). Current code has `compras/oc/[id]/recepciones` and `compras/oc/[id]/facturas` as forms. **Decide:** replace the current forms in place, or add `/nueva` sub-routes and keep the existing ones for edit? Default: replace in place (simpler).
12. ✅ **OT detail — transitions — RESOLVED.** Probe run 2026-04-19 against `flota7.db`:
    - **Mantenimiento** (129 rows, 5 states): Finalizado 99 (77%), Pendiente 12 (9%), En Reparación - Taller 9 (7%), Cancelado 5 (4%), En Reparación - Chacra 4 (3%). Chacra/Taller is a meaningful branching distinction. Zero mantenimientos use a plantilla (0/129) — confirms Q15.
    - **OT** (28 rows, 3 states used): Cerrada 18 (64%), En Curso 10 (36%). Simpler still.
    - Source of truth: `lib/mantenimiento/estado.ts` for mantenimiento, `app/(app)/ordenes-trabajo/types.ts` for OT. Both already have typed constants + transition helpers — do not re-implement.
    - **Decision:** deviate from design's linear 5-step `StatusMeter`. Use domain-accurate meters:
      - **Mantenimiento** → 3-step: `Pendiente → En Reparación → Finalizado`. Step 2 shows a sub-chip `Chacra` or `Taller` when active. Terminal `Cancelado` renders as a red variant of the Finalizado step with a strikethrough.
      - **OT** → 2-step: `En Curso → Cerrada`. `Cancelada` → red variant.
    - Status pill dropdown reads from existing `allowedTransitions()` + `isAdmin(session)` RBAC guard; do not rebuild.
    - **Design gap to flag back:** the Bundle 2 5-step meter doesn't fit either module cleanly. If Claude Design wants to iterate, the ask is "two meter variants — 3-step branching + 2-step linear". Otherwise we ship the simpler ones and call it a day.
13. **Files upload.** `mantenimiento-detalle.html` shows a files grid with image thumbnails + PDFs. No file storage exists yet. **Recommend:** render the section with `<EmptyState>` + "Próximamente" action disabled for Cervi v1; add storage backend post-cutover.
14. **Match banner tolerance.** `factura.html` shows an amber warn when any line's `qty` or `precio` differs from OC. Confirm threshold: exact match, or tolerate ≤1% price drift (VAT rounding)?
15. **Checklist — plantilla source.** OT detail Checklist assumes plantilla exists. Legacy data probe showed plantillas barely used. **Recommend:** section hides when no plantilla applied, instead of showing an empty checklist.

### 6.3 Things explicitly NOT in this redesign

- Charts richer than the 4 new shapes — no zoom, no hover tooltips with crosshairs. Hand-rolled SVG stays per AGENTS.md.
- Recharts adoption — **not now**. Revisit post-cutover if interactions get demanded.
- Kanban drag-and-drop — read-only lanes only.
- Calendar drag/resize — click only.
- Real-time updates / polling.

---

## 7. Sequencing + checkpoints

Ordered by user priority (confirmed): **empty/loading/error first, then mantenimiento forms, then recepción/factura, then everything else**.

### Phase R1 — Foundation (1 PR)
- §2 tokens + density/accent system
- §3.4 toast restyle
- Existing pages should still render correctly (visual diff only, no layout change).
- **Checkpoint:** screenshot every page; confirm only colors/spacing changed, no broken layouts.

### Phase R2 — Shell + shared states (1 PR)
- §3.1 sidebar (sectioned + footer)
- §3.2 topbar (search pill, tweaks button, bell)
- §3.3 tweaks panel
- §4.10 shared states set — ship early so every subsequent page can use them
- `lib/nav.ts` restructured
- **Checkpoint:** every existing page renders inside new shell; drop a `<TableRowsSkeleton />` + `<EmptyState>` into one list route and confirm.

### Phase R3 — Primitives (1 PR)
- §4.1 KPI tone variants
- §4.2 Toolbar
- §4.3 DataTable restyle (header + density)
- §4.4 DetailDrawer
- §4.5 StatusChip + OC status helper
- **Checkpoint:** drop new primitives into one page (e.g., listados/proveedores) and confirm they wire to existing data.

### Phase R4 — Easy pages (1 PR or 2)
- §5.1 Listados index
- §5.2 Listados/proveedores (pattern reference)
- §5.5 Compras OC
- **Checkpoint:** manual QA on each per `docs/qa-observations.md` style.

### Phase R5 — Mantenimiento stack (2 PRs)
User-confirmed highest priority after empty/loading/error.
- **R5a:** §4.11 OT form primitives + §5.9 Mantenimiento nueva OT page
- **R5b:** §4.12 OT detail primitives + §5.10 Mantenimiento detalle page
- Also wires `ordenes-trabajo/nuevo` + `ordenes-trabajo/[id]` to reuse the same components (per user: OT inherits from mantenimiento).
- **Checkpoint:** full create → detail → state-transition loop works end-to-end against real data.

### Phase R6 — Compras flows (2 PRs)
- **R6a:** §4.13 Recepción primitives + §5.11 Recepción page
- **R6b:** §4.14 Factura primitives + §5.12 Factura page
- **Checkpoint:** transactional recepción posts inventory movements; factura links to OC correctly.

### Phase R7 — Other module pages (1 PR each)
- §5.3 Inventario
- §5.4 Maquinaria
- §5.6 Mantenimiento list view (lists, drawer — not create/detail, those are R5)
- Each ships with its module-specific components in `components/<module>/`.

### Phase R8 — Calendar + Stats (1 PR each)
- §4.8 + §5.7 Órdenes — calendar is the heaviest single component.
- §4.6 + §5.8 Estadísticas — three new chart components, then assemble dashboard.

### Phase R9 — Sub-route polish (deferrable)
- §6.1 list. Pick highest-traffic ones first.
- Decide on responsive scope.

### Per-PR gates (non-negotiable, per CLAUDE.md)
- `npm run typecheck` clean
- `npm run lint` clean (existing React Hook Form warnings excepted)
- Screenshot diff in PR description
- Manual QA notes in `docs/qa-observations.md` if behavior changed

---

## 8. Task list

One row per shippable unit. IDs are stable — reference them in PRs and issues. Blockers reference other task IDs or open questions from §6.2 (e.g., `Q11` = §6.2 question 11). **Size** is a rough t-shirt: S = <1 day, M = 1-2 days, L = 2-4 days. "Docs ref" points to the section with the detailed spec.

### Phase R1 — Foundation

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R1-01 | Add design tokens | **In:** accent-sky/amber/violet + weak, success/warn/danger/info + weak, muted-2, subtle-foreground, border-strong, density vars in `app/globals.css`. `[data-accent]` + `[data-density]` root selectors. **Out:** tweaks panel wiring, dark-mode migration. | — | Every page still renders; `oklch` tokens resolve; `[data-accent="amber"]` swap visually flips `--brand`. | S | §2.1 |
| R1-02 | Tailwind `@theme` mapping | **In:** expose new tokens as `bg-brand`, `text-warn`, `border-border-strong` utilities. **Out:** refactor existing JSX to use them (next phases). | R1-01 | `grep -r 'oklch(' components/` stays flat; new utility classes compile in `npm run build`. | S | §2.2 |
| R1-03 | Sonner toast restyle | **In:** match Bundle 1 `.toast` styling (rounded pill, check icon, dark bg). **Out:** new toast API. | R1-01 | Calling `toast.success('x')` renders in new style across all modules. | S | §3.4 |

### Phase R2 — Shell + shared states

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R2-01 | Restructure `lib/nav.ts` | **In:** group 7 items into Operación / Análisis / Datos maestros sections matching `shared.js` `NAV`. **Out:** rendering changes (R2-02). | — | `NAV` export is sectioned; existing sidebar still works unchanged. | S | §3.1 |
| R2-02 | Sidebar sections + footer | **In:** render section headers; active-state bar + `--brand-weak` bg; footer with avatar/role/sign-out; compras badge = OC `Emitida` without recepción (new query in `lib/compras/pending-badge.ts`); inventario badge = existing `bajoMinimo`. **Out:** — | R1-01, R2-01 | All routes navigable; both badges show live counts; sign-out works. | M | §3.1, §6.2 Q1 |
| R2-03 | Topbar additions | **In:** search pill (opens empty cmdk with single "Próximamente" item), tweaks gear button, notifications bell (disabled + tooltip "Próximamente"), breadcrumb restyle. **Out:** real global search backend. | R1-01 | ⌘K opens cmdk with "Próximamente"; bell disabled; breadcrumbs use new styling. | M | §3.2, §6.2 Q2, Q3 |
| R2-04 | TweaksPanel | **In:** floating panel; **only dark-mode switch visible** for Cervi v1 (accent + density rendered but conditionally hidden behind `NEXT_PUBLIC_TWEAKS_ADVANCED === "1"`); `localStorage` hydrate on mount still applies all three attributes. **Out:** rol simulator (dropped per Q5). | R1-01, R2-03 | Dark toggle persists across reload; with env var set, accent + density appear and work. | M | §3.3, §6.2 Q4 |
| R2-05 | Shared states set | **In:** `EmptyState`, `InlineState`, `Skeleton` primitives + 4 composed patterns, `ErrorState`, `InlineError`. Shimmer keyframe in `globals.css`. **Out:** retro-fitting existing pages to use them (happens in later phases). | R1-01 | `npm run typecheck` clean; one demo route renders each variant. | M | §4.10 |

### Phase R3 — Primitives

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R3-01 | KPICard tone variants | **In:** extend `components/stats/kpi-card.tsx` with `tone` prop (neutral/warn/danger/ok/info). **Out:** change existing KPI call sites (later). | R1-01 | Storybook-style demo renders 5 tones; existing usages unchanged. | S | §4.1 |
| R3-02 | Toolbar component | **In:** `components/app/toolbar.tsx` — search + selects + pills + view-mode slots. **Out:** migrate existing pages (later). | R1-01 | Matches Bundle 1 inventario toolbar visually. | S | §4.2 |
| R3-03 | DataTable restyle | **In:** header sticky + `bg-muted-2`; row hover; density vars applied; existing API unchanged. **Out:** new columns API. | R1-01 | Every existing table renders with new styling; column behavior unchanged. | M | §4.3 |
| R3-04 | DetailDrawer | **In:** `Sheet` wrapper with tabs strip + scrollable body + optional footer. **Out:** domain-specific tab definitions (per-page). | R1-01 | Demo drawer renders 3 tabs; keyboard trap works; scrim closes. | M | §4.4 |
| R3-05 | StatusChip + OcStatus | **In:** generic `StatusChip` with tone + dot; `components/compras/oc-status.tsx` wrapping chip + progress for ESTADO_MAP; `lib/compras/oc-estado.ts` single source. **Out:** migrate all chip usages. | R1-01 | 6 OC estados render correctly with progress %. | S | §4.5 |

### Phase R4 — Easy pages

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R4-01 | Listados index | **In:** `CatalogTile` component + grouped tiles; live counts. **Out:** audit-log backend (stub link). | R2-*, R3-01 | 7 tiles render with real counts; hover chevron; click navigates. | S | §5.1, §4.9 |
| R4-02 | Listados/proveedores | **In:** KPI strip, Toolbar, DataTable, form-sheet for create/edit, row actions, back link. **Out:** other 6 catalogs (R9-01). | R3-01, R3-02, R3-03, R3-05 | Create/edit/desactivar/reactivar work; CUIT validation shows; manual QA logged. | M | §5.2 |
| R4-03 | Compras OC | **In:** list + DetailDrawer with 4 tabs (read-only); estado chip+progress; "Registrar recepción" / "Adjuntar factura" buttons link to R6-02/R6-04 pages. **Out:** requisiciones/facturas sub-routes (R9-03). | R3-01 through R3-05 | OC list matches Bundle 1; drawer opens on row click; estado map renders 6 states. | M | §5.5, §4.5 |

### Phase R5 — Mantenimiento stack

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R5-01 | OT form primitives | **In:** FormCard, TypeChooser, PrioritySegmented, MachineChip, RepuestosEditor, SummarySidebar. **Out:** page assembly (R5-02). | R1-01, R3-02 | Demo page renders all 6; RepuestosEditor add/remove/qty updates resumen live. | L | §4.11 |
| R5-02 | Mantenimiento nueva OT page | **In:** assemble §5.9 — 5 form-cards + sidebar + sticky footer; zod validation (estado defaults to "Pendiente" per `lib/mantenimiento/estado.ts`); POST creates OT + redirects. Plantilla picker disabled/hidden when no plantillas exist (legacy has 0 uses). **Out:** reuse for OT (R5-05). | R5-01, R2-05 | End-to-end: create OT from empty → detail page. Typecheck + lint clean. | M | §5.9, §6.2 Q12, Q15 |
| R5-03 | OT detail primitives | **In:** OTHero, StatusMeter (variant-agnostic component + 2 module presets: `MantenimientoStatusMeter` 3-step+sub-chip, `OtStatusMeter` 2-step), KVGrid, Checklist, PartesTable, Timeline, FilesGrid. Reuse `allowedTransitions()` from `lib/mantenimiento/estado.ts` for the status pill dropdown. **Out:** page assembly (R5-04). | R1-01, R3-04 | Demo page renders all 7; both meter presets render correct step counts; timeline shows 5 event types. | L | §4.12, §6.2 Q12 |
| R5-04 | Mantenimiento detalle page | **In:** assemble §5.10 — hero + meter (3-step mantenimiento variant) + 8 sections + sidebar. Status-change dropdown uses existing `allowedTransitions()` + `isAdmin()` RBAC. Checklist section **hidden entirely when no plantilla applied** (per Q15 — 0/129 legacy). Bitácora note POSTs to `MantenimientoHistorial` (tipoCambio='observacion'). FilesGrid renders EmptyState only (Q13 defers storage). **Out:** file upload backend. | R5-03, R2-05 | Full loop: open mantenimiento → change state → leave note → see historial update. All transactional. | L | §5.10, §6.2 Q12, Q13, Q15 |
| R5-05 | OT ordenes-trabajo reuse | **In:** wire `/ordenes-trabajo/nuevo` + `/ordenes-trabajo/[id]` to reuse R5-02 form and R5-04 detail. OT uses `OtStatusMeter` (2-step) instead of mantenimiento's 3-step. Parameterize default tipo + back-link + status helpers (`OT_ESTADOS` from `app/(app)/ordenes-trabajo/types.ts` instead of `MANT_ESTADOS`). **Out:** calendar page (R8-02). | R5-02, R5-04 | Both OT routes render and submit; 2-step meter renders correctly. | S | §5.9, §5.10, §6.2 Q12 |

### Phase R6 — Compras flows

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R6-01 | Recepción primitives | **In:** POStrip, ReceiveTable (row-status tints), QtyStepper, ReceiveBulkBar, ProgressRing (SVG), AttachBox. **Out:** page assembly. | R1-01 | Demo renders all 6; row-status auto-derives from ped/rec. | M | §4.13 |
| R6-02 | Recepción page | **In:** assemble §5.11 — POStrip + ReceiveTable + sidebar + footer. Transactional POST creates recepción + inventory movements. **Out:** bulk multi-OC recepción. | R6-01, R2-05, Q11 (route placement) | Complete receive flow posts correctly; inventory count updates atomically. | M | §5.11 |
| R6-03 | Factura primitives | **In:** InvoiceHeader, MatchBanner, FacturaLinesTable (line-diff highlighting), IvaPicker, OcLinkChip, TotalsSidebar. **Out:** page assembly. | R1-01 | Demo renders all 6; match banner flips to warn when precio differs. | M | §4.14 |
| R6-04 | Factura page | **In:** assemble §5.12 — header + match banner + line table + totals sidebar. Transactional factura create + link to OC. Tipo C/X header variants per Q15-like ask. **Out:** multi-OC factura. | R6-03, R2-05, Q11, Q14 (match tolerance) | Full factura entry posts; difference highlighting visible; totals recompute. | M | §5.12 |

### Phase R7 — Other module pages

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R7-01 | Inventario restyle | **In:** KPI strip (with tone), Toolbar, DataTable restyle, stock decision chip, DetailDrawer with Resumen/Movimientos/Facturas (last disabled per Q7), movement modal restyle. **Out:** deep-link `[id]` routing (Q = keep or kill). | R3-*, R2-05 | All existing flows work; stock chip matches §5.3; movement posts are transactional. | L | §5.3 |
| R7-02 | Maquinaria restyle | **In:** cards-or-table toggle, statusChip/serviceHealth/equipIcon, DetailDrawer (Resumen/Historial/Checklists/Documentos — last 2 empty-state per backend). **Out:** `tipos/`, `[tipoId]/` (R9-02). | R3-*, R2-05 | Cards + table both render; drawer opens per row. | L | §5.4 |
| R7-03 | Mantenimiento list view | **In:** 4-lane kanban toggle, list view, KanbanCard with priority dot + due-date + progress; link to OT detail (R5-04). **Out:** create form (already R5-02). | R3-*, R5-04 | Kanban lanes render; click card → detail; list toggle works. | M | §5.6, §4.7 |

### Phase R8 — Calendar + Stats

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R8-01 | WeekCalendar component | **In:** L-D × 8-18h grid, events absolute-positioned + colored by tipo, mini-month nav, filters sidebar, legend. **Out:** drag/resize (explicit non-goal). | R1-01 | Events render at correct positions; click → detail route; filters toggle. | L | §4.8 |
| R8-02 | Ordenes de trabajo page | **In:** assemble §5.7 — `grid-cols-[220px_1fr_220px]` with calendar. "Nueva OT" → R5-05. **Out:** new OT form (already R5-02). | R8-01, R5-05 | Page renders; week nav works; events from real data. | M | §5.7 |
| R8-03 | Chart primitives | **In:** Donut (extract from abc-pie), HorizontalBars, StackedBars, Heatmap. Hand-rolled SVG per AGENTS.md. **Out:** Recharts. | R1-01 | 4 demos render with synthetic data; dark mode respected. | L | §4.6 |
| R8-04 | Estadísticas dashboard | **In:** assemble §5.8 — KPI strip + 8 chart cards in 12-col grid. Real queries per chart. **Out:** sub-analyses routes (R9-04). | R8-03, R3-01, R2-05 | All 8 charts render with real data; empty states when no rows. | L | §5.8 |

### Phase R9 — Sub-route polish (deferrable)

| ID | Task | Scope (in / out) | Blockers | Acceptance | Size | Docs ref |
|---|---|---|---|---|---|---|
| R9-01 | Listados 6 sub-catalogs | **In:** apply R4-02 pattern to clientes/categorías/sectores/depósitos/tipos-maquinaria/unidades. **Out:** new fields schema. | R4-02, Q8 | 6 sub-catalogs match proveedores look-and-feel. | M | §6.1 |
| R9-02 | Maquinaria tipos | **In:** listados catalog-tile + proveedores detail pattern applied to `maquinaria/tipos` + `[tipoId]`. **Out:** — | R4-01, R4-02 | Types catalog navigable. | S | §6.1 |
| R9-03 | Compras sub-lists | **In:** apply tokens + Toolbar + DataTable to `compras/requisiciones`, `/recepciones` list, `/facturas` list. **Out:** create flows (done in R6). | R3-* | Three list views restyled. | M | §6.1 |
| R9-04 | Estadísticas sub-analyses | **In:** chart-card grid applied to `estadisticas/maquinaria`, `/proveedores`, `/abc`, `/precios`. **Out:** new analyses. | R8-03, R8-04 | Four sub-pages use new chart primitives. | M | §6.1 |
| R9-05 | Mantenimiento horometros + plantillas | **In:** table+sheet pattern applied. **Out:** plantilla batch generator (deferred per roadmap). | R4-02 | Horometros + plantillas restyled. | S | §6.1 |

### Global non-negotiables (per CLAUDE.md) — apply to every task

- `npm run typecheck` clean before commit.
- `npm run lint` clean (React Hook Form warnings excepted).
- Screenshot diff in PR description.
- No raw hex — tokens only.
- Spanish for domain strings via `messages/es.json`, English for infra.
- Legacy ids preserved (no new id schemes).
- Transactions for multi-row writes.

### Open questions that hard-block specific tasks

| Question | Blocks | Decision needed before |
|---|---|---|
| Q1 — compras sidebar badge source | R2-02 | ✅ resolved — OC `Emitida` without recepción |
| Q2 — global search scope | R2-03 | ✅ resolved — empty cmdk with "Próximamente" |
| Q3 — notifications bell | R2-03 | ✅ resolved — disabled with tooltip |
| Q4 — tweaks enabled in v1 | R2-04 | ✅ resolved — dark-mode only visible; accent/density gated by `NEXT_PUBLIC_TWEAKS_ADVANCED` |
| Q7 — Inventario facturas tab | R7-01 | R7 start |
| Q8 — listados sub-catalogs in v1 | R9-01 scope | R9 start |
| Q11 — recepción/factura route placement | R6-02, R6-04 | R6 start |
| Q12 — OT state machine | R5-02, R5-04 | ✅ probe run 2026-04-19 — see resolution below |
| Q13 — file storage | R5-04 (FilesGrid renders EmptyState or real upload) | R5 start |
| Q14 — factura match tolerance | R6-04 | R6 start |
| Q15 — OT plantilla fallback | R5-04 (Checklist section hidden when no plantilla) | R5 start |

### Suggested ticket-system mapping

If Linear/Jira/Paperclip: one parent epic per phase (R1-R9), child ticket per task (R1-01 etc.). Acceptance criteria from this table become the ticket's "Definition of Done". Blockers become ticket relations.

If GitHub issues: one milestone per phase; issue title format `[R5-02] Mantenimiento nueva OT page`; description = scope/blockers/acceptance copy-pasted. Open-questions table maps to discussion threads.

---

## Appendix A — File-creation checklist

New files this plan introduces (paths suggestive, not prescriptive):

- `components/app/tweaks-panel.tsx`
- `components/app/toolbar.tsx`
- `components/app/detail-drawer.tsx`
- `components/app/status-chip.tsx`
- `components/app/states/empty-state.tsx`
- `components/app/states/inline-state.tsx`
- `components/app/states/skeleton.tsx`
- `components/app/states/skeleton-patterns.tsx`
- `components/app/states/error-state.tsx`
- `components/app/states/inline-error.tsx`
- `components/listados/catalog-tile.tsx`
- `components/maquinaria/equip-card.tsx`
- `components/maquinaria/status-chip.tsx` (or extend shared status-chip)
- `components/compras/oc-status.tsx`
- `lib/compras/oc-estado.ts`
- `components/mantenimiento/kanban-card.tsx`
- `components/mantenimiento/form/form-card.tsx`
- `components/mantenimiento/form/type-chooser.tsx`
- `components/mantenimiento/form/priority-segmented.tsx`
- `components/mantenimiento/form/machine-chip.tsx`
- `components/mantenimiento/form/repuestos-editor.tsx`
- `components/mantenimiento/form/summary-sidebar.tsx`
- `components/mantenimiento/detail/ot-hero.tsx`
- `components/mantenimiento/detail/status-meter.tsx`
- `components/mantenimiento/detail/kv-grid.tsx`
- `components/mantenimiento/detail/checklist.tsx`
- `components/mantenimiento/detail/partes-table.tsx`
- `components/mantenimiento/detail/timeline.tsx`
- `components/mantenimiento/detail/files-grid.tsx`
- `components/compras/recepcion/po-strip.tsx`
- `components/compras/recepcion/receive-table.tsx`
- `components/compras/recepcion/qty-stepper.tsx`
- `components/compras/recepcion/receive-bulk-bar.tsx`
- `components/compras/recepcion/progress-ring.tsx`
- `components/compras/recepcion/attach-box.tsx`
- `components/compras/factura/invoice-header.tsx`
- `components/compras/factura/match-banner.tsx`
- `components/compras/factura/factura-lines-table.tsx`
- `components/compras/factura/iva-picker.tsx`
- `components/compras/factura/oc-link-chip.tsx`
- `components/compras/factura/totals-sidebar.tsx`
- `components/ordenes/week-calendar.tsx`
- `components/stats/donut.tsx`
- `components/stats/horizontal-bars.tsx`
- `components/stats/stacked-bars.tsx`
- `components/stats/heatmap.tsx`

Files significantly changed:

- `app/globals.css` — token expansion
- `app/(app)/layout.tsx` — wire tweaks panel mount
- `components/app/sidebar.tsx` — sections + footer
- `components/app/topbar.tsx` — search + actions row
- `components/stats/kpi-card.tsx` — tone variants
- `components/app/data-table.tsx` — header + density
- `lib/nav.ts` — sectioned nav

---

## Appendix B — i18n

Add namespaces to `messages/es.json` for any new visible strings. Specifically:

- `shell.search.placeholder`, `shell.tweaks.*`, `shell.notifications.*`
- `kpi.*` per page if KPIs gain new labels
- `kanban.lanes.*`
- `calendar.legend.*`
- `chart.titles.*`, `chart.empty`
- `tweaks.accent.*`, `tweaks.density.*`, `tweaks.theme.*`
- `states.empty.noResults.*`, `states.empty.noData.*`, `states.empty.emptyTab.*`, `states.error.server.*`, `states.error.forbidden.*`, `states.error.offline.*`
- `ot.form.steps.*`, `ot.form.priority.*`, `ot.form.hints.reservedNotConsumed`
- `ot.detail.status.*` (Creada/Asignada/Iniciada/Completada/Cerrada), `ot.detail.sections.*`, `ot.detail.timeline.eventTypes.*`
- `recepcion.status.*` (completo/parcial/no-recibido/pendiente), `recepcion.presets.*`, `recepcion.bulk.*`
- `factura.tipo.*` (A/B/C/X), `factura.match.ok`, `factura.match.warn`, `factura.diff.*`, `factura.iva.*`

Don't hardcode Spanish in JSX — keep AGENTS.md convention.
