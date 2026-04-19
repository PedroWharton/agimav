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
- **Status:** open
- **Repro:** `/mantenimiento`, set Estado filter to "Finalizado". Result: empty list. Must additionally tick "Incluir finalizados / cancelados" for rows to render.
- **Why this is wrong:** if a user explicitly filters *for* a terminal estado, the toggle should be implied. Current behavior makes the explicit filter look broken.
- **Proposed fix:** when Estado filter contains any of `Finalizado` / `Cancelado`, override the "incluir cerrados" toggle and include those rows. Or: drop the toggle and rely on the Estado multi-select alone (default-select non-terminal estados on first render).

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
- **Status:** open
- **Notes:** Tailwind v4 / shadcn defaults: native `<button>` doesn't ship `cursor-pointer`. Add to the base `Button` variant in `components/ui/button.tsx` so it propagates everywhere.

## QA-006 · Adding an insumo on a mantenimiento doesn't write a historial row

- **Module:** Mantenimiento (Phase 6, Slice A)
- **Severity:** high
- **Status:** open
- **Repro:** open a non-terminal mantenimiento, add an insumo via the editor, save. Historial timeline shows no new row.
- **Spec reference:** §4.2 — "insumo added/edited/removed at finalización" writes `tipo_cambio='insumo'`. Reading §4.1 + §4.2 together, **historial-on-add was scoped to finalización only** in the spec. This may be working as designed.
- **Question for product:** should adding an insumo **before** finalización also write historial? Pro: full audit. Con: historial noise (spec §11 already worried about chattiness). Decide before cutover.

## QA-007 · Insumos editor requires horizontal scroll to reach quantity column

- **Module:** Mantenimiento (Phase 6, Slice A) + OT (Slice D — same component)
- **Severity:** medium
- **Status:** open
- **Repro:** open a mantenimiento detail, scroll the insumos table — quantity column is offscreen on standard desktop widths.
- **Proposed fix:** trim the columns shown (e.g. collapse code + descripción into one cell, or truncate descripción with ellipsis), or restructure to a row-per-line card layout. Spec §6.2 listed Item / Cantidad sugerida / Cantidad utilizada / Costo unitario / Costo total — five columns is too many at desktop widths.

## QA-008 · Build error on `/estadisticas/abc` — invalid `"use server"` exports

- **Module:** Estadísticas (Phase 7, Slice B)
- **Severity:** **blocker**
- **Status:** **fixed (uncommitted)** — folded into QA-004 systemic refactor.

---

## QA-011 · Insumos editor accepts blank-item lines on save

- **Module:** Mantenimiento (Slice A) + OT (Slice D) — shared `InsumosEditor` component
- **Severity:** medium
- **Status:** open
- **Repro:** open an OT or mantenimiento detail → "Agregar línea" in the insumos editor → leave the Item combobox empty → save / cerrar / finalizar. Save proceeds; an empty-item row is persisted (or silently dropped — needs verification).
- **Why this is wrong:** an insumo line without an item is meaningless. Either it's persisted as junk (worst) or silently dropped (confusing — user doesn't know their click did nothing).
- **Proposed fix:** in the `InsumosEditor` (mantenimiento + OT both consume it), block submit when any line has no item selected, with a row-level field error ("Seleccioná un insumo o eliminá la línea"). Belt-and-suspenders: server-side reject lines with `itemInventarioId == null`.
- **Likely scope:** also check the equivalent editors in compras (requisición detalle, recepción detalle, factura detalle) — if they share the same shape they may have the same gap.

## QA-010 · Horómetro create form: date field has no default

- **Module:** Mantenimiento (Phase 6, Slice C)
- **Severity:** low
- **Status:** open
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

## Triage

- **Blockers:** ~~QA-004, QA-008, QA-009, QA-013, QA-014~~ — all fixed (uncommitted).
- **High / medium open:** QA-001, QA-002, QA-006 (needs product decision), QA-007, QA-011.
- **Low / deferred:** QA-003 (already on backlog), QA-005, QA-010, QA-012.

## Next steps

1. User reviews the use-server refactor diff and commits.
2. Resume Slice A/B QA from where it broke (plantilla detail page + insumos table).
3. Continue cataloguing UX findings as we walk Phase 6 → 4 → 5 → 7. Fixes batched at the end.
4. Decide QA-006 with Cervi or product owner before fixing.
