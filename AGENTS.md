<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project context — read before non-trivial work

This is the Next.js rewrite of Cervi's Tkinter/SQLite `flota7` app. Phases 0–7 have shipped; Phase 8 cutover is imminent (QA then migration day). Surface relevant context from the four files below to the user when the request touches them.

## Key docs (always check these first)

- **[`docs/roadmap-remaining.md`](docs/roadmap-remaining.md)** — phase status dashboard. Tells you what's done vs deferred. Phase 6 Slice B's plantilla **batch generator** is explicitly not wired (only manual "Aplicar").
- **[`docs/cutover-runbook.md`](docs/cutover-runbook.md)** — migration-day playbook. If the user's request is about cutover, DB parity, rollback, or `/api/health`, read this.
- **[`docs/post-cutover-backlog.md`](docs/post-cutover-backlog.md)** — deferred concerns with When/Shape/Why-deferred per item. **Before any non-trivial task, skim this.** If the user's request touches a backlog item — or naturally enables one — flag it so they can decide to in-scope.
- **[`docs/ux-spec/`](docs/ux-spec/)** — per-module UX specs. **Spec-first:** before any user-facing UI work, read the relevant spec.
- **[`README.md`](README.md)** — quick links + scripts + stack + repo layout.

## Cross-phase conventions (don't re-derive these)

- **Spec-first per module.** Never build UI without reading (or updating) the corresponding `docs/ux-spec/N-<module>.md`.
- **Spanish for domain, English for infra.** Match existing listados/inventario/maquinaria patterns. User-visible strings live in `messages/es.json` under a stable namespace.
- **Brand tokens only — no raw hex.** Use `sky-*` (primary), `amber-*` (accent/warn), `muted-*` (neutral). Avoid introducing new colors without checking `components/ui/` first.
- **Typecheck + lint clean before every commit.** `npm run typecheck` and `npm run lint` are non-negotiable. Pre-existing React Hook Form lint warnings (`form.watch()` compilation skipped) are known and not your fault.
- **Legacy ids preserved.** The SQLite→Postgres import (`scripts/migrate-from-sqlite.ts`) is idempotent and reseeds Postgres sequences to `max(id)+1`. Don't invent new id schemes.
- **Spanish domain words in model/route names are intentional** (`Requisicion`, `Maquinaria`, `Proveedor`, etc.). Keep them.
- **Slices ship mergeable.** Each phase breaks into slices A/B/C/… Each slice is one PR/commit unless the user explicitly says otherwise (Phase 4 was bundled into one commit per user direction; Phases 5–7 were split per-slice).

## Data-shape probes before new phases

Every phase we started began with a probe: `scripts/<phase>-probe.ts` reads `flota7.db` (source of truth for production data shapes) and prints row counts + state distributions. **The probe output frequently contradicts the spec** — Slice E of Phase 7 was scope-swapped because all legacy facturas carry `usuario='Sistema'`. Don't trust the spec over the probe.

When designing a new feature, if you're about to assume a data shape, check if there's a probe script. If not, run one before writing the feature.

## Charts

Charts are hand-rolled SVG in `components/stats/` (`SparkLine`, `AbcPie`, `PriceChart`, `HorizontalBarChart`). Recharts was deferred. If you need richer interactions (tooltips, legends, zoom), ask before pulling in Recharts.

## Auth + RBAC

- Auth.js v5. Invite-link password flow; no SMTP (see backlog).
- Role checks via `lib/rbac.ts` — `isAdmin(session)` is the most common. Don't re-implement role logic.
- `force-dynamic` is intentional on pages with live reads. Don't remove it.

## Safety rails

- **Never run `npm run db:seed` with a prod `DATABASE_URL`.** The seed creates `admin@cervi.local` / `cambiar123` for local dev only. A runtime guard is in the backlog but not yet implemented.
- **Transactions for multi-row writes.** OC generation, recepciones, facturas, OT insumo consumption — all use `prisma.$transaction` with interactive callbacks. Never split these into sequential non-transactional calls.
- **Don't mock the database in tests.** Hit a real ephemeral Postgres when tests get added post-cutover.

## When in doubt

Ask the user. Especially for: scope boundaries (is this a Phase 9? a backlog item?), cutover timing (is this safe to ship now or should it wait?), UX decisions not covered by the spec.
