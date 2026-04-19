# Cutover runbook — Phase 8

Step-by-step playbook for the migration day. Written 2026-04-19. Every command in this doc is expected to run from the repo root.

## Prerequisites

- [ ] All Phase 4–7 features have passed manual QA in staging against a recent `flota7.db` copy. (Tracked in per-phase `*_manual_qa_pending.md` memories — clear them before starting.)
- [ ] Tkinter is frozen for **structural** changes (no new tipos/niveles/atributos). Data entry continues.
- [ ] You have the **latest** `flota7.db` snapshot — ideally pulled within 24 h of cutover.
- [ ] Production Neon branch exists and its `DATABASE_URL` is set in Vercel prod env.
- [ ] Vercel build is green on `main`.
- [ ] You picked a low-activity window with Cervi (typically early weekend morning).
- [ ] **Never run `npm run db:seed` with a prod `DATABASE_URL`.** The seed creates `admin@cervi.local` / `cambiar123`, meant for dev only. The migration script imports the real `usuarios` from `flota7.db`; prod will already have the correct admin. (See backlog item *seed prod-safety guard* — the runtime guard is not yet implemented, so discipline is the only safeguard today.)

## T–30 min: pre-flight

```bash
# 1. Verify local build passes
npm run typecheck
npm run lint
npm run build

# 2. Confirm Prisma schema is in sync with prod
DATABASE_URL="<prod>" npx prisma migrate status
# Expect: "Database schema is up to date!"
```

If `migrate status` shows drift, stop. Investigate before continuing.

## T–0: freeze window opens

Announce to Cervi: **"Tkinter is now read-only — please do not enter data until we confirm it's safe."**

```bash
# 3. Copy the latest flota7.db into the agimav repo sibling dir (default path
#    in scripts/migrate-from-sqlite.ts). Or pass a custom path as argv[2].
cp /path/to/latest/flota7.db ../agimav/flota7.db

# 4. Apply any pending Prisma migrations to prod
DATABASE_URL="<prod>" npx prisma migrate deploy
```

## T+5: data migration

```bash
# 5. Run the SQLite → Postgres import (idempotent, upsert-by-legacy-id,
#    reseeds sequences, verifies row counts, exits non-zero on mismatch).
DATABASE_URL="<prod>" npm run db:migrate-legacy -- ../agimav/flota7.db
```

The script prints a source-vs-destination row count table at the end. **Every row must be `✓`**. If any row is `✗`, stop and investigate.

Typical run against Cervi's current `flota7.db` takes ~90 seconds.

## T+10: spot-check the prod DB

Open Prisma Studio against prod and eyeball a few records:

```bash
DATABASE_URL="<prod>" npx prisma studio
```

- [ ] `usuarios` — expected count matches source
- [ ] `maquinaria` — 236 rows, `estado` distribution reasonable
- [ ] `inventario` — ~672 rows with non-null `valor_unitario`
- [ ] `facturas` — totals look right for recent months
- [ ] `ordenes_compra` — state distribution matches legacy

## T+15: smoke-test the live app

Against the Vercel prod URL:

- [ ] `GET /api/health` returns `200 {"status":"ok","db":"up"}` (wire this to uptime monitoring before DNS flip)
- [ ] Login with a migrated usuario (invite-link flow still works — any user whose `estado=activo` can request a new invite)
- [ ] `/inventario` loads, shows expected item count
- [ ] `/maquinaria` lists all 8 tipos with counts
- [ ] `/maquinaria/[tipoId]` renders máquinas with principal atributo
- [ ] `/compras/requisiciones` loads and filters
- [ ] `/compras/oc` loads; open one, verify PDF renders
- [ ] `/estadisticas` dashboard renders all KPI cards without errors
- [ ] `/estadisticas/abc` runs ABC with default range
- [ ] `/estadisticas/precios` renders for an item with ≥2 points
- [ ] `/estadisticas/maquinaria` renders ranking
- [ ] `/estadisticas/proveedores` renders ranking + bar chart

If any of these 5xx, capture the Vercel log line, decide: fix forward (if trivial) or rollback.

## T+20: DNS flip

- [ ] Flip DNS CNAME / A record from Tkinter host to Vercel.
- [ ] Confirm resolution propagated (`dig <domain>`).
- [ ] Walk a Cervi admin through a single end-to-end action they do every day (e.g. create a requisición). Confirm it works.

## T+30: Tkinter read-only + backup window

- [ ] Keep a copy of the final `flota7.db` and the current Tkinter `Agimav23b.py` tagged with today's date. Store both in a 30-day retention folder.
- [ ] Tkinter stays available as read-only for 7 days in case of emergency rollback. After 7 days and no critical bugs, stop opening it.

## Post-cutover (next 30 days)

- [ ] Monitor Vercel logs daily for 500s and stack traces.
- [ ] Schedule a half-day onboarding session with Cervi power users.
- [ ] Capture any UX friction as GitHub issues tagged `post-cutover`.
- [ ] After 30 days of stability, archive `Agimav23b.py` + `flota7.db` with a README pointer to the new app's repo.

## Rollback

If the app proves unusable in the first 24 h and fixing forward is not feasible:

1. Flip DNS back to Tkinter host.
2. Copy the `flota7.db` from the 30-day retention folder back into the Tkinter working dir.
3. Notify Cervi that they're back on the legacy system and to stop entering data in the new one until further notice.
4. Root-cause the failure, fix, re-run cutover on a new window.

The prod Neon branch is **preserved** after rollback — the next cutover attempt just re-runs `db:migrate-legacy` which is upsert-based and will update rows that changed in Tkinter during the rollback window.

## Known non-blockers

- **`usuario_invite_tokens`** is not migrated — it's app-only. Any migrated usuario can request a new invite from the login screen.
- **`tabla_config`** entries are user-scoped UI preferences. If a particular user's columns look wrong after cutover, they can reconfigure from the UI.
- **Slice D (Phase 5) `destino`** defaults to NULL for legacy recepciones. Existing data continues to work; new recepciones capture it.

## Security: do not run `npm run db:seed` against prod

The seed script (`prisma/seed.ts`) creates a default admin `admin@cervi.local` with the weak password `cambiar123`. It is only meant for local dev. The migration script imports the real `usuarios` table from `flota7.db`, so prod already has the correct admin. **Never invoke `db:seed` with a prod `DATABASE_URL`.**
