# Agimav web — remaining roadmap (Phases 5–8)

> Handoff document. Phases 0–4 have shipped. This file is the detailed plan for everything that's left. Written 2026-04-18 after Phase 4 Slice D merged.

## Where we are (status as of this file)

- **Phase 0 (Foundation)** — done. Next.js 16 + Tailwind v4 + shadcn + Auth.js + Prisma + `next-intl` (es). Deployed shell.
- **Phase 1 (Data model + migration script)** — done. `prisma/schema.prisma` covers all 38 legacy tables plus the two drift tables (`mantenimiento_historial`, `mantenimiento_tareas`). `scripts/migrate-from-sqlite.ts` is idempotent, preserves legacy ids, reseeds sequences.
- **Phase 2 (Listados)** — done. Usuarios, roles, proveedores, localidades, unidades_productivas, tipos_unidad, unidades_medida. Invite-link password flow shipped; SMTP/forgot-password deferred until user base grows.
- **Phase 3 (Inventario)** — done. CRUD, entrada/salida movements, stock-minimo alerts, Excel import/export.
- **Phase 4 (Maquinaria)** — done. All four slices:
  - A: Tipo CRUD + structure viewer
  - B: Instance CRUD (recursive form, `ref` combobox to unidades/inventario)
  - C: Atributo add/archive/delete on existing niveles (nivel reparenting deferred — admins only, ticket-based)
  - D: Column config drawer persisting to `tabla_config` with fallback `[esPrincipal, estado, horasAcumuladas]`
- **Phase 5 (Compras)** — **next up**. No code yet. Spec not written.
- **Phase 6 (Mantenimiento + OT)** — not started.
- **Phase 7 (Estadísticas)** — not started.
- **Phase 8 (Cutover)** — not started.

## Conventions to keep in mind

- **Spec-first per module.** Write `docs/ux-spec/N-<module>.md` before any UI code. Review + approve the spec. Deviations during build are fine but document them back.
- **Spanish for domain, English for infra.** Match Listados/Inventario/Maquinaria patterns.
- **Brand tokens only, no raw hex.** Use token classes per foundation spec.
- **Typecheck + lint clean before merge.** `pnpm typecheck` and `pnpm lint` are CI-blocking.
- **Slices mergeable on their own.** Each slice ships behind its own PR with its own acceptance checklist.
- **Legacy data preserved by id.** The migration script is idempotent. Re-run before cutover.
- **Recurring fallback strategy:** if a slice balloons, ship a read-only viewer + "admin-managed via tickets" note and loop back later. See Phase 4 Slice C / nivel reparenting for the canonical example.

---

## Phase 5 — Compras pipeline

The largest module. Procure-to-pay flow with real transactions, supplier-aware grouping, partial receipts, invoice-price reconciliation, and OC PDF generation. **Plan for a week per slice.**

### High-level flow

```
Requisición (Borrador)
  → submit → En Revisión
  → approve → Aprobada    ─┐
  → reject  → Rechazada    │
                           ▼
                    assign supplier per detail
                           │
                           ▼
                    Asignado a Proveedor  ← new state, fixes legacy bug
                           │
                           ▼
                   generate OCs (grouped by supplier, in one tx)
                           │
                           ▼
                        OC (Emitida)
                           │
                           ▼
                   recepciones (partial allowed, cumulative)
                           │
                           ├─ destino=Stock → inventario_movimientos
                           └─ destino=Directa → nothing to stock
                           │
                           ▼
                   OC (Parcialmente Recibida / Recibida)
                           │
                           ▼
                   Facturas (lock recepciones_detalle.facturado=1)
                           │
                           ▼
                   precios_historico + weighted-avg cost update
```

### Slices (each = one PR)

#### Slice A — Requisiciones (Borrador → En Revisión)
- `/compras/requisiciones` list + detail.
- Create requisición (cabecera: solicitante, fecha, destino de uso, observaciones).
- Add detail lines: inventario item (Combobox, same pattern as maquinaria `ref`), cantidad, unidad (read-only from inventario), observaciones.
- `Borrador` → `En Revisión` submit transition.
- Actions: edit (only while Borrador), delete (only while Borrador), submit to review.
- Filter/sort by solicitante, fecha, estado.
- **Reads/writes:** `Requisicion`, `RequisicionDetalle`, `Inventario` (ref), `Usuario`.

#### Slice B — Aprobaciones (En Revisión → Aprobada / Rechazada)
- Approve/reject action on requisición (separate role check — usually Administrador).
- Audit trail: who, when, comments.
- `requisiciones_aprobaciones` table (or equivalent — check the schema).
- Email/in-app notification to requester (defer email; toast in-app for now — match listados password flow decision).
- **Reads/writes:** `Requisicion`, approval audit records.

#### Slice C — OC generation (Aprobada → Asignado a Proveedor → Emitida)
- **THE load-bearing slice.** This is where the legacy Python bug lives.
- **Fix:** persist per-detail supplier assignment as a new state `Asignado a Proveedor` before OC generation. In the current Tkinter code, `generar_ocs` (line 16405) groups suppliers from an in-memory dict that lives only inside the modal — if the user navigates away, they re-pick every supplier. We persist it.
- UI:
  - `/compras/requisiciones/[id]/asignar` screen: line-by-line supplier picker (Combobox from `proveedores`). Save draft, come back later.
  - Once all lines have a supplier, enable "Generar OCs" button.
  - On generate: group detail lines by supplier → create one `OrdenCompra` per group → move state to `Emitida`. **All in one `prisma.$transaction`** so we don't create OC headers without details on failure.
- OC numbering: reuse legacy sequence (the migration preserves ids; new OCs use `max(id)+1` via Postgres sequence).
- **OC PDF** (`@react-pdf/renderer`) matching ReportLab layout — company block left, supplier block right, itemized table with qty/price/discount/subtotal, totals footer. Budget a full day for pixel-matching. Reference: `crear_pdf_oc_profesional` at `Agimav23b.py:16813`.
- **Reads/writes:** `Requisicion`, `RequisicionDetalle`, `Proveedor`, `OrdenCompra`, `OrdenCompraDetalle`. Emits PDF file (store as blob? or generate on-demand? — decide in spec; lean toward on-demand to keep storage cheap).

#### Slice D — Recepciones (Emitida → Parcialmente Recibida / Recibida)
- `/compras/recepciones` — list + detail.
- Create recepción against an `Emitida` OC: select OC → show all detail lines with `cantidad_pendiente = cantidad - cantidad_recibida_acumulada`.
- Per line: input `cantidad_recibida_ahora` (≤ pendiente), observaciones, **`destino: Stock | Directa`** (persisted — legacy didn't track this).
- On save (transactional):
  - Insert into `Recepcion` + `RecepcionDetalle` rows.
  - Update `RequisicionDetalle.cantidad_recibida` (cumulative).
  - Update OC state: `Parcialmente Recibida` or `Recibida`.
  - If `destino=Stock`: insert `InventarioMovimiento` (entrada type) with the received qty.
  - If `destino=Directa`: skip inventory movement.
- **Edge cases:** partial → partial → complete flow; over-reception blocked; destino mid-line mix (line 1 Stock, line 2 Directa — fine).
- **Reads/writes:** `Recepcion`, `RecepcionDetalle`, `OrdenCompra`, `RequisicionDetalle`, `InventarioMovimiento`.
- Reference: `procesar_recepcion` at `Agimav23b.py:17526`.

#### Slice E — Facturación + weighted-avg cost
- `/compras/facturas` — list + detail + create flow.
- Create factura against one or more `RecepcionDetalle` rows where `facturado = 0`:
  - Select proveedor → show unfacturado recepcion details from that proveedor.
  - Per line: ingresa precio_neto_factura (after discount), IVA/other taxes (configurable).
  - Flag discrepancies: if factura unit price differs from OC unit price, show warning badge + require confirmation.
- On save (transactional):
  - Insert `Factura` + `FacturaDetalle`.
  - **Lock:** `RecepcionDetalle.facturado = 1` (strict — can't re-invoice).
  - Write to `PrecioHistorico` with post-discount `precio_neto`, timestamp, proveedor.
  - **Weighted-average cost update** per inventario item: `new_cost = (old_cost * old_qty + invoice_cost * invoice_qty) / (old_qty + invoice_qty)`. Store on `Inventario.costo_promedio` (or equivalent field — verify name).
- Reference: `procesar_factura` at `Agimav23b.py:19644`.
- **Reads/writes:** `Factura`, `FacturaDetalle`, `RecepcionDetalle` (lock), `PrecioHistorico`, `Inventario` (cost update).

### Spec to write: `docs/ux-spec/4-compras.md`

Must cover (use the 11-section template from Phase 4 spec):

1. Purpose + users (procurement clerk, approver, accounting)
2. Screens: requisiciones list, requisición detail, asignar proveedor, OCs list, OC detail + PDF, recepciones list + create, facturas list + create
3. **State machines — explicit.** Every entity's states + allowed transitions + which role can trigger each.
4. Components:
   - `ProveedorCombobox` — reuse maquinaria ref combobox pattern.
   - `DetalleLinesEditor` — reusable multi-row editor for reqs, recepciones, facturas.
   - `OCPdf` — `@react-pdf/renderer` component.
   - `PriceDiscrepancyBadge`.
5. Data model touch: per slice above. Confirm schema already has these from Phase 1.
6. Edge cases per slice — see above.
7. i18n: `compras.requisiciones.*`, `compras.oc.*`, `compras.recepciones.*`, `compras.facturas.*`, `compras.estados.*`.
8. Out of scope for v1:
   - Multi-currency (USD invoices) — defer to Phase 7 (price history already stores it).
   - Reopening closed OCs.
   - Supplier self-service portal.

### Legacy Python references (Phase 5)

| What | File:Line |
|---|---|
| OC generation + supplier grouping | `Agimav23b.py:16405` (`generar_ocs`) |
| OC PDF generation | `Agimav23b.py:16813` (`crear_pdf_oc_profesional`) |
| Recepción processing | `Agimav23b.py:17526` (`procesar_recepcion`) |
| Factura processing + price history + cost update | `Agimav23b.py:19644` (`procesar_factura`) |

### Phase 5 risks

1. **PDF fidelity.** Suppliers receive these. Budget a full day per slice-C PR.
2. **Transaction boundaries.** Any partial failure in OC generation, recepción, or factura creation must roll back everything — no half-state. Use `prisma.$transaction` with interactive callbacks, not batched arrays (Prisma batches don't give you early-abort semantics).
3. **Supplier assignment UX.** The new `Asignado a Proveedor` state is a UX departure from legacy. Walk Cervi through it early — they're used to doing it in one modal. Consider a "Assign all + Generate" shortcut for the power user path.
4. **Invoice-vs-OC price discrepancies.** Decide the threshold (exact match? ±1%? ±5%?). Ask Cervi before shipping.
5. **Concurrent OC generation on the same requisición.** Two users both clicking "Generate" at once. Mitigate with optimistic locking on requisición `updatedAt` or a state check inside the transaction.

---

## Phase 6 — Mantenimiento + Órdenes de Trabajo

Two closely-related sub-modules. Mantenimientos are the higher-level record ("machine X needs a service"); OTs are the execution detail with insumos consumed.

### Slices

#### Slice A — Mantenimiento core (correctivo + preventivo)
- `/mantenimiento` list — filter by máquina, tipo (correctivo/preventivo), estado.
- `/mantenimiento/[id]` detail + edit.
- State machine: `Pendiente` → (`En Reparación - Chacra` | `En Reparación - Taller`) → (`Finalizado` | `Cancelado` | `Revisión Programada`).
- Audit via `mantenimiento_historial` (drift table, declared in Phase 1 schema).
- Fields: máquina (Combobox across all tipos — hard one, filter by tipo+nroSerie+principal), tipo mantenimiento, descripción, fecha_programada, fecha_inicio, fecha_fin, responsable, costo_estimado, costo_real, observaciones.
- **Reads/writes:** `Mantenimiento`, `MantenimientoHistorial`, `Maquinaria`.
- Reference: `registrar_historial_mantenimiento` at `Agimav23b.py:5193`.

#### Slice B — Plantillas de mantenimiento (preventivos recurrentes)
- `/mantenimiento/plantillas` — CRUD plantillas.
- Plantilla = tipo de máquina + periodicidad (cada N horas / N días) + lista de tareas + lista de insumos esperados.
- Aplicar plantilla a una máquina: genera el próximo mantenimiento en `Pendiente` con fecha calculada desde último horómetro o desde última vez aplicada.
- Batch generator: cron (or manual admin button) that scans active plantillas and creates pending mantenimientos that are due.
- **Reads/writes:** `MantenimientoPlantilla`, `MantenimientoPlantillaTarea`, `MantenimientoPlantillaInsumo`, `MantenimientoTareas` (drift table).

#### Slice C — Registro de horas
- `/mantenimiento/horometros` simple form — select máquina, input current horómetro, date.
- Writes to `RegistroHorasMaquinaria` + updates `Maquinaria.horas_acumuladas`.
- Validation: new reading > last reading.
- **Very light** — current production data has only 6 rows in the legacy table, so this flow is barely used. Ship read-only viewer + simple create; defer bulk import.

#### Slice D — Órdenes de Trabajo (OT)
- `/ordenes-trabajo` list + detail + create.
- OT optionally linked to a Mantenimiento (1-to-many: one mantenimiento can spawn multiple OTs over time).
- `OtInsumos` — track inventory consumed on this OT. On save, create `InventarioMovimiento` (salida type) for each insumo line.
- Tasks checklist (`mantenimiento_tareas` — drift table).
- State machine: `Abierta` → `En Progreso` → `Completada` | `Cancelada`.
- **Reads/writes:** `OrdenTrabajo`, `OtInsumos` (or similar — verify schema), `MantenimientoTareas`, `Mantenimiento`, `InventarioMovimiento`.

### Spec to write: `docs/ux-spec/5-mantenimiento.md` + `docs/ux-spec/6-ordenes-trabajo.md`

Or combine them — the overlap is high. Lean toward combined spec to reduce duplication.

### Phase 6 risks

1. **Plantilla application timing.** Triggering creation of pending mantenimientos needs a cron or manual-admin trigger. Decide in spec; cron means Vercel Cron (hobby plan has limits).
2. **Máquina combobox performance.** 236 machines across 8 tipos = ~236 options. Acceptable without virtualization but watch if tipos grow.
3. **Task checklist UX.** Legacy Python uses a free-text "tareas" field. We likely want structured rows. Confirm with Cervi before modeling.

---

## Phase 7 — Estadísticas

Dashboards and analytics. Lower write-side complexity, higher read-side complexity.

### Slices

#### Slice A — KPI dashboard
- `/estadisticas` home: KPI cards + small trend sparklines.
- Cards: total máquinas activas, inventario por debajo de mínimo, OCs abiertas, mantenimientos pendientes, facturas del mes en USD.
- Time-range selector (7d / 30d / 90d / ytd / all).
- **Reads:** aggregations across multiple tables. Use Prisma `groupBy` + `count` where possible; raw SQL for anything chart-heavy.

#### Slice B — Análisis ABC de inventario
- Classic ABC classification by consumption value.
- Inputs: item, consumption qty in window × precio_promedio → value.
- Sort desc, compute cumulative %, label A (top 80%), B (next 15%), C (last 5%).
- Export to Excel.

#### Slice C — Evolución de precios USD
- Uses `dolar_cotizaciones` table + `precios_historico`.
- Per item: price timeline in ARS + USD (converted at the rate for that date).
- Line chart with Recharts.
- Filter by item, proveedor, date range.

#### Slice D — MTBF + métricas por máquina
- MTBF (mean time between failures) per máquina: average hours between consecutive `Mantenimiento` rows of tipo `correctivo`.
- Per máquina: hours operated (from horómetro deltas), mantenimientos correctivos, mantenimientos preventivos, costo total.
- Ranking table sortable by any metric.

#### Slice E — Gasto por usuario vs promedio
- Sum of facturas (lines where solicitante = usuario) vs team average.
- Bar chart + ranking table.

### Spec to write: `docs/ux-spec/7-estadisticas.md`

Cover: chart types, color tokens (no raw hex — use brand tokens), filter UX, export format, empty states.

### Phase 7 risks

1. **Query performance on aggregations.** Add indexes if any view takes > 500ms. Check `EXPLAIN ANALYZE` against real Cervi data.
2. **USD conversion with missing rates.** Some dates may not have a rate row. Fallback: last-known rate with an "aproximado" badge.
3. **Chart library accessibility.** Recharts is fine but test keyboard nav on the ranking tables.

---

## Phase 8 — Cutover

The last mile. No new features — all focus on stability and data parity.

### Checklist

1. **Freeze structural changes on Tkinter.** Ask Cervi admins to stop changing tipos/niveles/atributos from Phase 4 onwards. Non-structural data entry continues.
2. **Production Neon branch.** Spin up from current single prod branch (see memory: we deferred a dev branch for v1). Provision connection strings, wire to Vercel prod env.
3. **Re-run `scripts/migrate-from-sqlite.ts`** against the latest `flota7.db` snapshot during a short freeze window. Verify row counts match source exactly.
4. **Acceptance testing on staging.** Walk Cervi users through every module. Capture bugs as a release blockers list.
5. **DNS cut.** Low-activity day (check with Cervi — typically weekend or early morning). Flip DNS, keep Tkinter read-only as a backup for 30 days.
6. **Post-launch monitoring.** Sentry wired (or pick a simpler service — evaluate cost). Vercel Analytics basic.
7. **Archive Tkinter.** After 30 days stable, archive the `.py` + `.db` files with a README pointer to the new app.

### Phase 8 risks

1. **Hidden data shapes.** Users may have entered weird data that passes Tkinter validation but fails Next.js validation (Zod is stricter). Dry-run the migration early, log every failure, fix.
2. **Sequence drift.** If any id column is inserted in between re-runs, sequences get out of sync. The migration script reseeds — verify the reseed actually runs after every import.
3. **Users resisting the new UI.** Budget a half-day for Cervi onboarding sessions. Record a quick loom walkthrough.
4. **Rollback plan.** If a critical bug surfaces post-cutover, keep the Tkinter `.py` + last known-good `flota7.db` available for 7 days. Worst case, point users back there while we fix.

---

## Cross-phase reminders

- **Memory files in `~/.claude/projects/-Users-pedrowharton-Desktop-proyectos-agimav/memory/`** — check before assuming anything. Notably:
  - Listados password flow (invite-only, SMTP deferred)
  - Neon branch setup (single prod branch, dev branch deferred)
- **CLAUDE.md global rules** — run typecheck + lint before every commit, use brand token classes, consult UX spec before any UI work.
- **Nothing is merged until the acceptance checklist passes.** From the master plan: typecheck + lint, Prisma schema matches spec, migration clean, UX matches spec, 2–3 Playwright golden paths, manual QA, stakeholder review.

## Open items still unresolved

- **SMTP / forgot-password flow** — will be needed once user base grows past the invite-link tolerance. Probably Phase 8 prep.
- **Sentry or equivalent error tracking** — defer decision to Phase 8.
- **Mobile form ergonomics** — Cervi uses tablets on chacra. No mobile testing done yet. Ideally revisit after Phase 5 Slice B lands so we have the compras flows on a tablet too.
- **Multi-doc attachments per máquina** — Cervi raised in walkthrough. Not in legacy. Parking for post-cutover.
- **Invoice price discrepancy threshold** — exact/±1%/±5%? Ask Cervi in Phase 5 spec review.
- **Plantilla-de-mantenimiento trigger** — cron vs manual. Decide in Phase 6 spec review.

---

## Entry point when we pick this back up

1. Read this file + the master plan at `.claude/plans/1-online-only-is-wobbly-kitten.md`.
2. Probe `flota7.db` for Phase 5 data shape: row counts and state distributions on `requisiciones`, `requisiciones_detalle`, `ordenes_compra`, `recepciones`, `facturas`. Confirm how many requisiciones currently sit in each state.
3. Write `docs/ux-spec/4-compras.md`. Review with user. Approve.
4. Start Phase 5 Slice A.
