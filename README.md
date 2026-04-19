# agimav-web

Next.js rewrite of the Tkinter/SQLite Agimav/flota7 application used by Cervi to manage maquinaria, inventario, compras, mantenimiento, and operational statistics. Preserves all 38 legacy tables and legacy ids; ships as a web app with Postgres (Neon) + Auth.js + Prisma.

## Quick links

- **[`docs/roadmap-remaining.md`](docs/roadmap-remaining.md)** — phase status dashboard (Phases 0–7 done, Phase 8 cutover pending).
- **[`docs/cutover-runbook.md`](docs/cutover-runbook.md)** — step-by-step playbook for migration day (T–30 → T+30, rollback plan).
- **[`docs/post-cutover-backlog.md`](docs/post-cutover-backlog.md)** — deferred concerns with When / Shape / Why-deferred per item. **Skim this before starting any non-trivial task.**
- **[`docs/ux-spec/`](docs/ux-spec/)** — per-module UX specs (spec-first per phase).
- **[`AGENTS.md`](AGENTS.md)** — guidance for AI coding agents.

## Getting started

```bash
# Install deps
npm install

# Copy env template and fill in DATABASE_URL, AUTH_SECRET, etc.
cp .env.example .env.local

# Apply migrations to the target DB
npx prisma migrate deploy

# (Local dev only) seed roles + a default admin
npm run db:seed

# (One-off) import data from a flota7.db snapshot — idempotent
npm run db:migrate-legacy -- /path/to/flota7.db

# Run the dev server
npm run dev
```

Open http://localhost:3000 to access the app.

> **Do not run `db:seed` with a production `DATABASE_URL`.** The seed creates a weak-password admin (`admin@cervi.local` / `cambiar123`) intended for local dev only. See the cutover runbook's security note.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run typecheck` | `tsc --noEmit`. **CI-blocking. Run before every commit.** |
| `npm run lint` | ESLint. **CI-blocking.** |
| `npm run db:generate` | Regenerate Prisma client. |
| `npm run db:migrate` | Apply pending migrations in dev. |
| `npm run db:migrate-legacy` | Import data from `flota7.db` into Postgres (idempotent). |
| `npm run db:seed` | Seed roles + dev admin. Dev-only. |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run db:cleanup-inventario` | One-off cleanup for inventario data drift. |

## Tech stack

- **Framework:** Next.js 16 (App Router, server components by default).
- **DB:** Postgres on Neon; Prisma client via `@prisma/adapter-pg`.
- **Auth:** Auth.js v5. Invite-link password flow (SMTP deferred — see backlog).
- **i18n:** `next-intl`, Spanish locale.
- **UI:** Tailwind v4 + shadcn/ui. Brand tokens only, no raw hex.
- **Charts:** hand-rolled SVG (`components/stats/*`). Recharts deferred.
- **PDF:** `@react-pdf/renderer` for OC export.
- **Excel:** `xlsx` for inventario + estadísticas exports.

## Project conventions

- **Spec-first per module.** Write the UX spec in `docs/ux-spec/` before any UI code.
- **Spanish for domain, English for infra.** Matches legacy conventions.
- **Brand tokens only.** Use `sky-*`, `amber-*`, `muted-*` token classes; never raw hex.
- **Typecheck + lint clean before every commit.** Non-negotiable.
- **Legacy ids preserved.** Migration script is idempotent; sequences reseeded to `max(id)+1`.

## Repo layout

```
app/
  (app)/                 # authenticated routes (module pages)
    compras/             # requisiciones, oc, recepciones, facturas
    maquinaria/          # tipos + instances + ficha
    mantenimiento/       # mantenimientos + plantillas + horómetros
    ordenes-trabajo/     # OTs
    inventario/          # stock + movements
    estadisticas/        # KPI dashboard + abc + precios + maquinaria + proveedores
    listados/            # usuarios, roles, proveedores, localidades, etc.
  api/
    auth/                # Auth.js handlers
    health/              # GET /api/health for uptime monitoring
components/
  app/                   # layout shell, PageHeader, Combobox, etc.
  stats/                 # hand-rolled SVG charts
  ui/                    # shadcn primitives
docs/
  cutover-runbook.md
  post-cutover-backlog.md
  roadmap-remaining.md
  ux-spec/
lib/
  auth.ts                # Auth.js config
  db.ts                  # Prisma singleton
  rbac.ts                # role checks
  generated/prisma/      # Prisma client (generated)
prisma/
  schema.prisma
  migrations/
  seed.ts
scripts/
  migrate-from-sqlite.ts # legacy data import (idempotent)
  *-probe.ts             # one-off data-shape probes per phase
```

## License

Private / Cervi-internal. Not for redistribution.
