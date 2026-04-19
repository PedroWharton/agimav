# UX Spec 3 — Maquinaria

Scope: the fleet/equipment register. CRUD for **tipos** (machine classes), CRUD for **machine instances** with attributes rendered from each tipo's structure, plus small edits to the attribute list on an existing nivel. **Out of v1**: drag-to-reparent niveles, creating new niveles from UI, and the structure-sync diff job — those stay Tkinter-managed until we have a reason to pull them forward (see §10).

This is the module the master plan flagged as the biggest unknown. The reality check (§2) is why we can safely ship the fallback-plus scope instead of the full dynamic tree editor.

## 1. Purpose & user

Give Cervi a single place to:

- keep the register of every tractor, curadora, plataforma, vehículo, autoelevador, etc. in use today (~236 machines);
- for each machine, record both the flat facts (marca, modelo, año, dominio) and the hierarchical "child" parts the legacy app models as `maquina_nodos` (e.g., a *Motor* node hanging off a *Tractor*);
- let downstream modules (Mantenimiento, OT, Compras) reference a machine without manual retyping.

- **Primary actor:** `Administrador` — owns the register; creates/edits tipos, niveles, and instances.
- **Secondary actor:** `Mecánico`, `Encargado` — read-only in v1 for all structure, read-only for instances they don't own. They pick a machine when creating a mantenimiento or OT in later phases.
- **Primary job-to-be-done:** *"Which tractor is T-25? What's its dominio, who runs it, and what motor does it have?"* — fast lookup, clean detail view. Editing is rare (a handful of times per month); reading is constant.
- **Why it matters:** Phase 6 (Mantenimiento) and Phase 5 (Compras) both foreign-key machines. If this module doesn't land, those modules have nothing to point at.

## 2. Reality check — what the data actually looks like today

Probe on current Neon snapshot (2026-04-18, `scripts/maquinaria-probe.ts`):

**Tipos (8 total, ~236 instances):**

| Tipo | Instancias | Niveles | Max depth | Atributos | `ref` atributos | list | number | date |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Tractor | 140 | 3 | 1 | 21 | 12 (inventario + UP) | 0 | 0 | 0 |
| Curadora | 57 | 1 | 0 | 6 | 1 (UP) | 0 | 1 | 0 |
| Vehículo | 19 | 2 | 1 | 9 | 1 (inventario) | 0 | 0 | 0 |
| Plataforma | 15 | 2 | 1 | 7 | 1 (UP) | 0 | 0 | 0 |
| Autoelevador | 2 | 2 | 1 | 5 | 0 | 0 | 0 | 0 |
| Trituradora | 2 | 1 | 0 | 3 | 1 (UP) | 1 | 0 | 0 |
| Rotoenfardadora | 1 | 1 | 0 | 3 | 1 (UP) | 0 | 0 | 0 |
| Abonadora | 0 | 1 | 0 | 3 | 1 (UP) | 0 | 0 | 0 |

(`UP` = `unidades_productivas`.)

**Values (`maquina_atributos_valores`, 3,354 rows total):**

- `value_text`: 3,354
- `value_num`: **0**
- `value_date`: **0**

The legacy app effectively stores every attribute as a string, even when the `data_type` on the atributo definition is `number`. This means Phase 4 needs the discriminated storage in schema (already in place) but in practice the write path coerces to text for parity with Tkinter, **and** we display numbers/dates by parsing text on read. This is legacy debt we carry, not something we clean up in v1.

**Other probes:**

- `tabla_config`: 40 rows — 35 `attribute` kind + 5 `builtin`. Populated for 7 of 8 tipos (Abonadora has none). `target_depth` values are all 0 or 1 — the legacy "depth nuance" was barely used.
- `maquina_nodos`: 551 rows (236 machines + 315 child nodes). Fits the "depth 1" picture: on average ~1.3 child nodes per machine.
- `registro_horas_maquinaria`: 6 rows. Not a real flow yet; stays deferred to Phase 6.
- `esPrincipal` flag: exactly 1 per tipo. Invariant holds.
- `permiteInventario`: true on every nivel in production data. Effectively always-on.

**Implications for the spec:**

1. **No deep tree editor needed.** Max observed depth is 1. The recursive instance form handles arbitrary depth for future-proofing, but we don't need fancy drag-tree UX for niveles.
2. **Numbers and dates are strings at rest.** The form collects `number`/`date` via typed inputs but writes them to `valueText` with a normalised string format (`toFixed(2)` for numbers; ISO `YYYY-MM-DD` for dates). Schema fields `valueNum`/`valueDate` stay unused in v1. **Trade-off:** we keep parity with Tkinter and avoid a data-cleanup migration, at the cost of deferring "real" typed storage. Cleanup migration is a Phase 8 pre-cutover item, not Phase 4.
3. **Only 2 `ref` sources in use** (`unidades_productivas`, `inventario`). The ref picker is a small, closed-set switch, not a generic table-picker.
4. **Skip the `list` atributo special UI.** A single atributo in the whole system (Trituradora's estado) uses it. Render `list_options` via a plain `<Select>`.
5. **`permiteInventario`-per-nivel is effectively dead data.** We still persist it (schema parity) but the UI defaults it to `true` and doesn't expose toggling in v1.
6. **`esPrincipal`** matters — it's the atributo whose value becomes the machine's "display name" in lists. Every tipo already has one. Guard the invariant in v1 (read-only display) but don't let users toggle it.
7. **`tabla_config` keeps its current shape.** Slice D simplifies *access* (a Drawer with drag-to-reorder visible columns) but the on-disk representation stays the existing rows — no migration. The `target_depth` column is always written as `0` from the new UI (all columns render on the machine root, not on child nodes); legacy rows with `target_depth=1` continue to work in the read path.

## 3. Scope & shipping plan

Four mergeable slices. Each ships on its own.

### Slice A — Tipo CRUD + structure viewer (PR #1)

- Route shell `/maquinaria` — default lands on a tipo picker + redirect to `/maquinaria/[tipoId]`.
- `/maquinaria/tipos` — admin-only list of 8 tipos (plus `+ Nuevo tipo`).
- Create/edit tipo Sheet (nombre, estado, unidadMedicion, abrevUnidad).
- Delete blocked if `maquinarias` count > 0.
- **Structure viewer** inside the tipo detail: read-only hierarchical tree of niveles with their atributos. Shows: nivel name, parent arrow, atributo name, dataType, `requerido`, `esPrincipal` badge, `sourceRef` if ref. No edit affordance in Slice A.
- No instance changes yet — the tipo list has a "Ver instancias" link that's still greyed out.

### Slice B — Maquinaria instance CRUD (PR #2) — *the load-bearing slice*

- `/maquinaria/[tipoId]` — TanStack table of instances for the selected tipo. Default columns come from the current `tabla_config` rows for that tipo; if the tipo has none (Abonadora), we fall back to `[esPrincipal, estado, horasAcumuladas]`.
- Tipo switcher in the page header — tabs or dropdown, depending on count (8 tipos fits as tabs).
- `+ Nueva máquina` → Sheet rendered **recursively from the tipo's structure**:
  - Root nivel fields first, in `orden` order.
  - Each child nivel rendered as a collapsible section with its own atributo fields.
  - Field components driven by `dataType`: `text` → Input; `number` → Input type=number (stringified on submit); `date` → DatePicker (ISO on submit); `list` → Select with `list_options`; `ref` → Combobox wired to `unidades_productivas` or `inventario` depending on `sourceRef`.
  - `requerido` → `required` + zod-enforced.
  - `esPrincipal` atributo visually marked with a *Principal* badge; the field itself is a normal input — the flag only controls display.
- Edit uses the same Sheet; delete is block-on-FK (mantenimientos, registros_horas, ot.*).
- Detail drawer on row click: read-only render of the same tree, plus machine meta (`nroSerie`, `estado`, `horasAcumuladas`), plus a "Editar" button that opens the Sheet.
- Search + filter on the list:
  - Search: matches the machine's **`esPrincipal` value** (the "display name"), `nroSerie`.
  - Filter: `estado`, and a generic filter on any `ref`-typed atributo the tipo defines (e.g., Tractor lets you filter by Unidad Productiva).

### Slice C — Atributo add/remove on existing niveles (PR #3)

- Structure viewer gains row actions (admin only):
  - `+ Atributo` on a nivel row → Dialog to create a NivelAtributo (nombre, dataType, requerido, list_options if list, sourceRef if ref).
  - `Editar` on an atributo row → update label, `requerido`, `list_options`, but not `dataType` (data_type change is a migration, not a v1 feature).
  - `Desactivar` on an atributo row → sets `activo=false`. Existing values stay, new instance forms skip inactive atributos, edit forms render inactive atributos as disabled with a muted *"Atributo archivado"* label.
  - Hard `Eliminar` only when `valores` count = 0; otherwise only `Desactivar`.
- Creating a new atributo on a nivel that has existing instances → confirmation dialog explaining existing machines get the attribute as null and will need to be edited to fill it in.
- **Not in Slice C:** creating or deleting niveles themselves, reparenting, toggling `esPrincipal`. Those need the sync-estructura job and are deferred.

### Slice D — Column config + stakeholder walkthrough (PR #4)

- Columns drawer on the instance list: reorder + toggle visibility. Persists to `tabla_config` rows (insert/update/delete as needed). `target_depth` always `0`.
- Column options shown:
  - **Builtins** (5 max): `esPrincipal`, `nroSerie`, `estado`, `horasAcumuladas`, `createdAt`. Only `esPrincipal` is always-visible (locked).
  - **Attributes**: every `activo` atributo in the tipo's structure, grouped by nivel.
- Stakeholder walkthrough on staging.
- i18n pass + typecheck.

**Out of Phase 4 entirely** (explicit):

- **Nivel creation / deletion / drag-reparent.** Deferred until we have the sync-estructura diff job. Current tipos are stable per the Phase-4-freeze ask in the master plan.
- **Sync estructura background job.** Not needed until we allow structural edits.
- **Hour-meter registration** (`registro_horas_maquinaria`). Phase 6 Mantenimiento.
- **Machine-to-inventario linkage on `maquina_nodos.inventarioItemId`.** Schema already supports it; UI exposure waits for Phase 6's "repuestos en uso" flow.
- **Tipo → factura / compras cross-references.** Phase 5.
- **ABC / uptime / MTBF dashboards.** Phase 7.

## 4. Schema touches (pre-build)

Everything needed already exists in `prisma/schema.prisma` from Phase 1. Minor additions:

1. **Audit columns on `Maquinaria`.** Add `createdById Int?` (nullable FK → `Usuario`). `createdAt`/`updatedAt` already present.
2. **Audit columns on `MaquinariaTipo`.** `createdById Int?` nullable FK. `createdAt`/`updatedAt` already present.
3. **No changes to `MaquinaNodo`, `MaquinaAtributoValor`, `NivelAtributo`, `TipoNivel`, `TablaConfig`.** The current shape handles everything the spec needs.
4. **Index check:** existing `maquina_atributos_valores (nodoId, atributoDefId, valueText)` covers the lookup path for the list. No new indexes.
5. **Backfill:** none. All additions are nullable.

## 5. Screens

Six surfaces. Wireframes show information density; exact polish follows foundation tokens.

### 5.1 Tipos list — `/maquinaria/tipos` (admin)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Tipos de maquinaria                                     [+ Nuevo tipo]  │
│ Administración de clases de máquina y sus estructuras.                  │
│ ─────────────────────────────────────────────────────────────────────── │
│ Nombre           │ Estado  │ Unidad      │ Instancias │ Atributos │  ⋯ │
│ ─────────────────────────────────────────────────────────────────────── │
│ Tractor          │ Activo  │ Horas (hs)  │ 140        │ 21        │  ⋯ │
│ Curadora         │ Activo  │ Horas (hs)  │ 57         │ 6         │  ⋯ │
│ Vehículo         │ Activo  │ Km (km)     │ 19         │ 9         │  ⋯ │
│ ...                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

Row kebab: `Editar` · `Ver estructura` · `Ver instancias` · `Eliminar` (disabled with tooltip when `instancias > 0`).

### 5.2 Tipo Sheet — create / edit

```
┌─────────────────────────────────────────┐
│ Editar tipo                         ×   │
├─────────────────────────────────────────┤
│ Nombre *                                │
│ [Tractor______________________]         │
│                                         │
│ Estado                                  │
│ ○ Activo   ● Inactivo                   │
│                                         │
│ Unidad de medición    Abreviatura       │
│ [Horas_______]        [hs____]          │
│                                         │
│                      [Cancelar] [Guardar] │
└─────────────────────────────────────────┘
```

### 5.3 Structure viewer — `/maquinaria/tipos/[id]/estructura` (admin)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Volver a tipos                                                        │
│ Tractor — Estructura                                       [+ Atributo] │
│ ─────────────────────────────────────────────────────────────────────── │
│ ▼ Nivel: Tractor                                                        │
│    · Marca             text     [Requerido]  [★ Principal]          ⋯  │
│    · Modelo            text     [Requerido]                         ⋯  │
│    · Año               number                                       ⋯  │
│    · Dominio           text                                         ⋯  │
│    · Unidad Prod.      ref → unidades_productivas                   ⋯  │
│                                                                        │
│ ▼ Nivel: Motor  (hijo de Tractor)                                      │
│    · Serie             text                                         ⋯  │
│    · Cilindrada        text                                         ⋯  │
│    · Repuesto instal.  ref → inventario                             ⋯  │
│                                                                        │
│ ▼ Nivel: Caja  (hijo de Tractor)                                       │
│    · ...                                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

- In Slice A the row kebabs and `+ Atributo` are disabled (view-only).
- In Slice C they become active; edits scope to **atributos only** — niveles themselves stay read-only.
- The tree is rendered from the normalized parent chain; indentation + `hijo de {parentName}` label instead of a real tree widget. No drag handles.

### 5.4 Instances list — `/maquinaria/[tipoId]`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Máquinas                                        [Columnas] [+ Nueva máquina] │
│ [Tractor] [Curadora] [Vehículo] [Plataforma] [Autoelev.] [Trit.] [Rotoe.]    │
│ ──────────────────────────────────────────────────────────────────────────── │
│ [Buscar por dominio o marca… 🔎]  [Estado ▾]  [Unidad Productiva ▾]          │
│                                                                   140 tractores │
│ ──────────────────────────────────────────────────────────────────────────── │
│ ★ Principal   │ Modelo      │ Año   │ Dominio  │ UP       │ Estado  │ ⋯ │
│ ──────────────────────────────────────────────────────────────────────────── │
│ John Deere    │ 5090E       │ 2019  │ AB123CD  │ Chacra N │ Activo  │ ⋯ │
│ Case          │ Farmall 110 │ 2021  │ AA456FF  │ Chacra S │ Activo  │ ⋯ │
│ New Holland   │ T6.130      │ 2017  │ —        │ Chacra N │ Baja    │ ⋯ │
│ ...                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Tipo switcher:** tabs across the top. Clicking a tab updates the route. `/maquinaria` with no tipoId redirects to the first tipo that has instances > 0 (Tractor).
- **Filter row:** search (principal value ILIKE unaccent + nroSerie prefix), `estado`, plus one dynamic filter per `ref` atributo on the root nivel. Not per-child-nivel ref atributos — keeps the filter strip bounded.
- **Columns:** come from `tabla_config`. Fallback order when the tipo has no config: `★ Principal`, `estado`, `horasAcumuladas`.
- **Row kebab:** `Ver detalle` · `Editar` · `Eliminar` (block-on-FK).
- **Empty state:** `No hay máquinas cargadas para {tipo}. Creá la primera.` + CTA.

### 5.5 Máquina Sheet — create / edit

```
┌─────────────────────────────────────────────────────────────┐
│ Nueva máquina · Tractor                              ×      │
├─────────────────────────────────────────────────────────────┤
│ General                                                     │
│  Nº Serie          Estado                                   │
│  [__________]      [Activo ▾]                               │
│  Horas acumuladas                                           │
│  [ 0.0 ]                                                    │
│                                                             │
│ Tractor — atributos                                         │
│  Marca *  ★                                                 │
│  [John Deere___________]                                    │
│  Modelo *                                                   │
│  [5090E_______________]                                     │
│  Año              Dominio                                   │
│  [ 2019 ]         [AB123CD]                                 │
│  Unidad Productiva                                          │
│  [Chacra Norte ▾]                                           │
│                                                             │
│ ▸ Motor  (opcional)                                         │
│    Serie                 Cilindrada                         │
│    [__________]          [__________]                       │
│    Repuesto instalado                                       │
│    [Buscar inventario… ▾]                                   │
│                                                             │
│ ▸ Caja  (opcional)                                          │
│    ...                                                      │
│                                                             │
│                                  [Cancelar] [Guardar]       │
└─────────────────────────────────────────────────────────────┘
```

- **Form layout:** the root nivel's atributos sit inside a *{tipo} — atributos* group. Each child nivel sits in a collapsible section (closed by default on create; open by default on edit). Child sections are always "opcional" in v1 — we don't enforce presence of child nodes even if the nivel has `requerido` atributos; users create the child node by filling any of its fields, skip it by leaving them blank.
- **Principal badge:** the star `★` on `Marca` is purely visual.
- **Ref fields:** Combobox with async search against `unidades_productivas.nombre` (ILIKE) or `inventario.codigo/descripcion` (ILIKE unaccent). Selected value stored as the referenced id serialized to text in `valueText` (legacy parity).
- **Date fields:** DatePicker; submitted as ISO `YYYY-MM-DD`.
- **Number fields:** number input; submitted as a normalized decimal string (`String(Number(raw))`).
- **Validation:** zod per-field derived from the structure. `requerido` → non-empty string. Numbers must parse. Dates must parse.
- **Server action:** wraps a Prisma interactive transaction:
  1. Upsert `Maquinaria` row (insert on create, update on edit).
  2. For the root nivel, upsert the `MaquinaNodo` row (`parentNodeId=null`).
  3. For each child nivel section with any filled field, upsert a `MaquinaNodo` with `parentNodeId = root.id`.
  4. For every atributo touched, upsert a `MaquinaAtributoValor` (`{nodoId, atributoDefId}` unique → `valueText`). Empty string deletes the row.
  5. Leave nodes and values for untouched inactive atributos alone (Slice C archival path).
- **Error surface:** field-level zod errors inline; form-level error from the server action rendered at the bottom.

### 5.6 Máquina detail drawer

```
┌─────────────────────────────────────────────────┐
│ John Deere 5090E · AB123CD                  ×   │
├─────────────────────────────────────────────────┤
│ Estado: Activo   Horas acumuladas: 1 245,5 hs   │
│ Nº Serie: 0028847                               │
│                                                 │
│ Tractor                                         │
│   Marca:   John Deere                           │
│   Modelo:  5090E                                │
│   Año:     2019                                 │
│   Dominio: AB123CD                              │
│   UP:      Chacra Norte                         │
│                                                 │
│ Motor                                           │
│   Serie:       4045HJ12                         │
│   Cilindrada:  4.5L                             │
│   Repuesto:    123992 · Filtro aceite Donaldson │
│                                                 │
│ Caja                                            │
│   (sin datos)                                   │
│                                                 │
│                                [Editar]         │
└─────────────────────────────────────────────────┘
```

Read-only render of the same recursive tree, showing only non-empty values. Empty child niveles render a muted `(sin datos)`. No movement history / mantenimiento history tabs in v1 — those live in later phases.

## 6. Components

Reuses everything from Phase 2 & 3 where possible:

- `ModuleHeader`, `AppSheet`, `ConfirmDialog`, `DataTable` (TanStack), `TableColumnsMenu` — all existing.
- **New for Phase 4:**
  - `StructureTree` — read-only recursive renderer for niveles + atributos. Takes a normalized structure (array of niveles with parent arrows). Slice A only needs the viewer; Slice C adds row-action slots.
  - `MaquinaForm` — recursive form renderer. Input: tipo structure + optional current values. Output: a canonicalized payload keyed by `{nivelId, atributoId}` → string.
  - `RefCombobox` — async combobox with two known sources (`unidades_productivas`, `inventario`). Accepts a `sourceRef` and debounced search.
  - `TipoSwitcher` — tabs (≤ 10) or dropdown (> 10). v1 uses tabs.
  - `ColumnsDrawer` — Slice D only; reorder + visibility for the instance list.

No chart components. No drag-and-drop library in v1 (the one place we'd use it — nivel reparenting — is out of scope).

## 7. Data model touch (read paths)

- **Instance list page** → `Maquinaria.findMany({ where: { typeId }, include: { nodos: { include: { atributos: true } } } })` + a per-row lookup of `tabla_config` rows to decide columns. Hydrated once per page load; stored in the RSC.
- **Máquina detail / edit** → same include shape but for a single id.
- **Structure viewer** → `MaquinariaTipo.findUnique({ include: { niveles: { include: { atributos: true } } } })`. Niveles ordered by `orden ASC, id ASC`; atributos within a nivel ordered by `id ASC`.
- **Ref search** → raw Prisma queries against `unidades_productivas` (trivial) and `inventario` (reuses the Phase 3 search index on `lower(unaccent(descripcion))`).

## 8. States & edge cases

- **Tipo with 0 niveles.** Shouldn't exist in production data (every tipo has at least a root nivel) but we guard: instance Sheet renders a banner *"Este tipo no tiene estructura configurada."* and disables save.
- **Tipo with 0 atributos.** Same banner, same disable. (Abonadora is close: 3 atributos but 0 instances.)
- **Missing `esPrincipal` atributo on a tipo.** Invariant violation — should never happen. If it does, the list falls back to showing `nroSerie` in the `★ Principal` column and logs a warning.
- **Instance with a stale child node.** If a node points to a nivel that's been soft-deleted / not returned by the structure query, the detail drawer surfaces it under a *"Datos de estructura anterior"* section rather than hiding it. Edit Sheet doesn't render fields for it; the data sits untouched. We don't cascade-clean on structure changes in v1 (no structure changes in v1).
- **`ref` target disappeared.** Atributo references an inventario id that no longer exists → detail shows `valueText` verbatim with a muted `(no encontrado)` suffix. Edit Sheet keeps the current value selected even though it's unresolvable, so we don't silently wipe it.
- **Duplicate `esPrincipal` value across machines.** Not enforced. Two tractors named "John Deere 5090E" are fine; the list is scoped by type, not by principal uniqueness.
- **Concurrent edit.** Optimistic — last writer wins. Machine edits are rare enough not to justify optimistic locking in v1. Revisit if we see conflict complaints.
- **Deleting an inventario item referenced by a `ref` atributo value.** Phase 3's delete-block rule covers this: `Inventario.delete` is blocked if any `MaquinaAtributoValor.valueText` stores that id as a ref. Verify Slice B's delete guard list includes this before merge.
- **Deleting a UP referenced by an atributo value.** Phase 2's listados delete guard covers `unidades_productivas`. Same verify step.
- **Tipo rename.** Allowed. Updates propagate via FK to nodes. No cascade work needed.
- **Tipo delete with 0 instances but ≥ 1 niveles.** Allowed. Cascade deletes niveles + atributos.

## 9. i18n

New namespace: `maquinaria.*`.

- `maquinaria.tipos.*` — tipo list + form (titulo, nuevoTipo, nombre, estado, unidadMedicion, abrevUnidad, eliminar, eliminarBloqueado, etc.).
- `maquinaria.estructura.*` — structure viewer (titulo, nivelLabel, atributoLabel, dataType.text|number|date|list|ref, esPrincipal, requerido, activoArchivado, nuevoAtributo, confirmarNuevoAtributo).
- `maquinaria.maquinas.*` — instance list + form + drawer (titulo, nuevaMaquina, buscar, estado.activo|inactivo|baja, horasAcumuladas, nroSerie, sinDatos, sinEstructura, refNoEncontrado, principalBadge).
- `maquinaria.columnas.*` — Slice D drawer.

Shared with existing: `common.*`, `listados.common.*`.

## 10. Open questions / deferred

- **Sync estructura diff.** If Cervi needs a new child nivel on Tractor before Phase 4 ends, we do it via a one-off script in `scripts/` and a seed PR, not UI. Once the need becomes recurring, pull the Phase-4 deferred slice.
- **Real typed storage** (`valueNum`, `valueDate`). Deferred until Phase 8 cutover prep. A migration will read existing `valueText` values, parse by atributo's `dataType`, and populate the typed columns, keeping `valueText` as a display fallback. Not in scope here.
- **Multi-image / doc attachments per machine.** Mentioned by Cervi in the walkthrough script; not in the legacy app. Needs its own spec; parking for post-cutover.
- **Mobile form ergonomics.** Cervi walks around chacra with tablets. The form flows vertically so it's usable, but we haven't tested. Revisit after Slice B ships on staging.

## 11. Acceptance per slice

Each slice ships with:

1. `pnpm typecheck` + `pnpm lint` clean.
2. Prisma schema unchanged or additive-only; migration file runs clean on dev Neon.
3. Screenshots of the slice's main surfaces in the PR description.
4. For Slice B specifically: a manual QA path exercising Tractor create → edit → delete + Curadora create (single-nivel tipo) to confirm the recursive form handles both depths.
5. i18n review — no raw Spanish strings outside `messages/es.json`.
