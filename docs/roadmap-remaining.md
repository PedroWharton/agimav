# Agimav web — phase status

> Originally a handoff doc written 2026-04-18 before Phase 5. Rewritten 2026-04-19 to reflect status after Phases 5–7 shipped. For outstanding work, see **[post-cutover-backlog.md](./post-cutover-backlog.md)**. For cutover day, see **[cutover-runbook.md](./cutover-runbook.md)**.

## Status at a glance

| Phase | Status | Notes |
|---|---|---|
| 0 — Foundation | ✅ done | Next.js 16 + Tailwind v4 + shadcn + Auth.js + Prisma + next-intl. |
| 1 — Schema + migration | ✅ done | 38 legacy tables + drift tables. `scripts/migrate-from-sqlite.ts` idempotent, reseeds sequences. |
| 2 — Listados | ✅ done | Invite-link password flow; SMTP deferred (see backlog). |
| 3 — Inventario | ✅ done | CRUD, entrada/salida, stock-minimo alerts, XLSX import/export. |
| 4 — Maquinaria | ✅ done | All 4 slices (A+B+C+D) shipped as one bundled commit `7a43806`. |
| 5 — Compras | ✅ done | Slices A–E including weighted-avg cost update and OC PDF. |
| 6 — Mantenimiento + OT | ✅ done ¹ | All 4 slices shipped. Plantilla **batch generator** deferred — only manual "Aplicar" wired. |
| 7 — Estadísticas | ✅ done | KPI dashboard + ABC + precios + MTBF + gasto por proveedor. Slice E swapped from "por usuario" — see note below. |
| 8 — Cutover | 🟡 prep done | Runbook + `/api/health` ready. Awaiting manual QA (tomorrow) → migration day. |

¹ The one caveat: Slice B's batch/cron trigger that auto-creates pending mantenimientos from active plantillas is **not wired**. The manual "Aplicar plantilla" action exists. Captured in the backlog as *next quarter*.

## Per-phase acceptance summary

### Phase 5 — Compras
- Requisiciones pipeline with state machine Borrador → En Revisión → Aprobada → Asignado a Proveedor → OC emitted.
- OC generation is transactional (one tx per requi, all detail lines + headers or nothing).
- Supplier assignment **persisted** per line (fixes the legacy Tkinter bug where it lived in a dict in the modal).
- Recepciones support partial + destino (Stock vs Directa), Stock triggers InventarioMovimiento.
- Facturas lock recepcion detail rows (`facturado=1`), write `PrecioHistorico`, update weighted-avg `Inventario.valorUnitario`.
- OC PDF via `@react-pdf/renderer` matches legacy ReportLab layout.

### Phase 6 — Mantenimiento + OT
- Mantenimientos with state machine Pendiente → (En Reparación — Chacra/Taller) → Finalizado | Cancelado | Revisión Programada. Audit via `mantenimiento_historial`.
- Plantillas CRUD + manual "Aplicar" to generate a pending mantenimiento on one máquina.
- Registro de horas form + read-only viewer.
- OT with insumos consumption triggering InventarioMovimiento (salida), tasks checklist, state machine Abierta → En Progreso → Completada | Cancelada.

### Phase 7 — Estadísticas
- `/estadisticas` KPI dashboard with 5 cards + 12-month facturación sparkline.
- `/estadisticas/abc` ABC classification + XLSX export.
- `/estadisticas/precios` evolución de precios (ARS + USD overlay when FX known; "aproximado" band when missing).
- `/estadisticas/maquinaria` MTBF + métricas per máquina (date-based MTBF — see backlog for hours-based upgrade).
- `/estadisticas/proveedores` gasto ranking + top-10 bar chart + XLSX export. **Scope swap** from "gasto por usuario": all legacy facturas carry `usuario='Sistema'` so the original report was dead-on-arrival. Gasto-por-usuario parks for 6 months post-cutover when real usuario data accrues.

## What's left

1. **Manual QA day-0** — walk every module end-to-end against a recent `flota7.db`. Tracked in the per-phase `*_manual_qa_pending.md` memories.
2. **Cutover** — follow [cutover-runbook.md](./cutover-runbook.md).
3. **Everything in [post-cutover-backlog.md](./post-cutover-backlog.md)** — triage weekly for 30 days, deep-review at day 30 / 90 / 180.

## Conventions kept across all phases

- Spec-first per module (`docs/ux-spec/N-<module>.md`). Deviations documented back.
- Spanish for domain, English for infra.
- Brand tokens only, no raw hex.
- `npm run typecheck` + `npm run lint` clean before every commit.
- Legacy data preserved by id; migration script idempotent.
- Fallback strategy: if a slice balloons, ship read-only + "admin-managed via tickets" and loop back. Used for Phase 4 Slice C nivel reparenting.
