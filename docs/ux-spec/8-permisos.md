# UX Spec 8 — Permisos por rol

Scope: let an admin configure, per role, which actions that role can perform across the app. Replaces the current hard-coded `Administrador` / `Pañolero` predicate pair with a data-driven permission catalog that an admin edits from the UI.

## 1. Purpose & user

Today every gate in the app funnels through two hard-coded predicates (`isAdmin`, `isPañolero`). That's fine for 2 roles and 8 users — it falls over the moment Cervi wants, say, a `Mecánico` role that can create mantenimientos and view stock but can't update inventario or see estadísticas. This spec delivers that.

- **Primary actor:** `Administrador` — configures permisos for each role from `/listados/roles/[id]/permisos`.
- **Secondary actor:** every other role — gets the app filtered to what their permisos allow (sidebar items hidden, action buttons hidden, server actions reject with `forbidden`).
- **Primary job-to-be-done:** "I want to give our new mecánico exactly these capabilities and nothing else, without asking a developer."
- **Why it matters:** without this, adding a new role type = shipping code. Cervi has already asked for a mecánico-specific role; similar asks will follow (chofer, capataz, contador). The current binary admin/non-admin gate can't express those.

## 2. Reality check (what's gated today)

Call-site probe 2026-04-23 — 244 `isAdmin`/`isPañolero`/`requireAdmin`/`requirePañolero` hits across `app/`, `lib/`, and `components/`.

| Module | `isAdmin` hits | `isPañolero` hits | Notes |
|---|---|---|---|
| Listados | 94 | 0 | CRUD on every master-data entity + roles + usuarios; all admin-only. |
| Compras | 28 | 3 | Pañolero exception: **create recepción**. Everything else admin-only. |
| Mantenimiento | 26 | 0 | `isAdmin` also gates the `Cancelado` state transition in `lib/mantenimiento/estado.ts`. |
| Maquinaria | 21 | 0 | All admin — tipos, estructura, instance CRUD, columnas. |
| Inventario | 19 | 2 | Pañolero exception: **register movimiento** (entrada/salida). Everything else admin-only. |
| Estadísticas | 7 | 0 | Admin-only for `/estadisticas/proveedores` + XLSX exports. Dashboard view is authenticated-only. |
| `lib/rbac.ts` | 6 | 1 | The predicates themselves. |
| `lib/mantenimiento/estado.ts` | 4 | 0 | State-machine gate. |
| `components/app/sidebar.tsx` | 2 | 0 | Sidebar role label. |

**Implications for the catalog:**

1. Today's implicit permissions are **coarse** (module-level admin gate + two narrow carve-outs). Any new permission set is additive — we're introducing granularity that doesn't exist yet.
2. **Pañolero's real job** in code = "warehouse operator who receives goods and moves stock". Encode as two named permisos: `compras.recepcion.create` and `inventario.movimiento.create`.
3. **No row-level scopes exist today** (no "only my UP" checks). Ship pure role-level permisos in v1. Row-level is a post-cutover enhancement — see §8.
4. Everything that's not explicitly gated is **authenticated-only**. The baseline "you're logged in" still applies to every route under `(app)/`.

## 3. Non-goals (v1)

- **Multi-tenant.** `Rol` stays single-tenant. Design leaves room to bolt on `tenantId` later (see §7) but we don't build it now.
- **Row-level / scope-based permisos** ("only mantenimientos for my UP", "only OCs I created"). Post-cutover.
- **Per-user permisos.** Permisos attach to roles, not users. A user gets exactly the permisos of their one role.
- **Permission inheritance / role hierarchies.** Flat. Two roles with overlapping permisos duplicate checkboxes, by design — keeps the mental model simple.
- **Custom permission codes.** The catalog is code-seeded and not user-editable. Admins pick from the shipped list; they don't invent new codes.

## 4. Permission catalog (v1)

Permisos are flat strings, namespaced as `modulo.accion` (or `modulo.entidad.accion` for finer carve-outs). The catalog is seeded at migration time and expands by shipping code.

**Convention:** `view` implies read-only list + detail. `create`/`update`/`delete` are the obvious writes. Anything not in the catalog is implicitly admin-only via the `admin.all` override.

### Maquinaria
- `maquinaria.view` — list + detail
- `maquinaria.create` — crear nueva máquina
- `maquinaria.update` — editar ficha
- `maquinaria.delete` — baja lógica
- `maquinaria.tipos.manage` — CRUD tipos + estructura (niveles/atributos)
- `maquinaria.columnas.configure` — reordenar/ocultar columnas (`tabla_config`)

### Inventario
- `inventario.view` — list + detail
- `inventario.create` — alta de ítem
- `inventario.update` — editar ítem (incluye `stockMinimo`)
- `inventario.delete`
- `inventario.movimiento.create` — entradas/salidas (pañolero histórico)
- `inventario.ajuste_stock` — ajuste directo de stock
- `inventario.import_export` — XLSX

### Compras
- `compras.view` — listar requisiciones / OCs / recepciones / facturas + detalle
- `compras.requisicion.create`
- `compras.requisicion.approve` — Borrador → En Revisión → Aprobada transitions
- `compras.oc.create` — generar OCs desde requisición
- `compras.oc.update` — editar OC (pre-envío)
- `compras.recepcion.create` — carga de recepciones (pañolero histórico)
- `compras.recepcion.update`
- `compras.factura.create` — incluye el weighted-avg update de `valorUnitario`
- `compras.factura.update`

### Mantenimiento
- `mantenimiento.view`
- `mantenimiento.create`
- `mantenimiento.update` — incluye transiciones de estado excepto Cancelado
- `mantenimiento.cancel` — transición a Cancelado (hoy admin-only)
- `mantenimiento.delete`
- `mantenimiento.plantillas.manage` — CRUD plantillas + "aplicar"
- `mantenimiento.horas.register` — `RegistroHorasMaquinaria`

### Órdenes de Trabajo
- `ot.view`
- `ot.create`
- `ot.update`
- `ot.close` — transición a Completada
- `ot.delete`

### Estadísticas
- `estadisticas.view` — dashboard principal + sub-rutas públicas (ABC, precios, maquinaria)
- `estadisticas.proveedores.view` — `/estadisticas/proveedores` (hoy admin-only)
- `estadisticas.export` — XLSX de ABC, proveedores

### Listados (master data)
- `listados.view` — read-only para cualquier usuario autenticado
- `listados.usuarios.manage` — CRUD usuarios + invite links
- `listados.roles.manage` — CRUD roles + editar permisos (este spec)
- `listados.proveedores.manage`
- `listados.master_data.manage` — localidades, tipos-unidad, unidades-medida, unidades-productivas

### Umbrella
- `admin.all` — bypasses every `hasPermission` check. Granted to the `Administrador` rol at seed time. Prevents bootstrap paradoxes (see §5.4).

**Catalog summary:** ~38 permisos across 7 módulos + umbrella.

## 5. Schema touches

Two new tables, one migration, one seed.

### 5.1 New models (Prisma)

```prisma
/// Catalog of permission codes. Seeded at migration time; not user-editable.
model Permiso {
  id          Int    @id @default(autoincrement())
  codigo      String @unique           // "maquinaria.view", etc.
  modulo      String                    // "maquinaria", used for UI grouping
  descripcion String                    // Spanish label for the checkbox

  roles RolPermiso[]

  createdAt DateTime @default(now()) @map("created_at")

  @@index([modulo])
  @@map("permisos")
}

/// Join table: which permisos each rol has.
model RolPermiso {
  rolId     Int @map("rol_id")
  permisoId Int @map("permiso_id")

  rol     Rol     @relation(fields: [rolId], references: [id], onDelete: Cascade)
  permiso Permiso @relation(fields: [permisoId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now()) @map("created_at")
  createdById Int?     @map("created_by")
  createdBy   Usuario? @relation("RolPermisoCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  @@id([rolId, permisoId])
  @@index([rolId])
  @@map("rol_permisos")
}
```

`Rol` gets a back-relation: `permisos RolPermiso[]`.
`Usuario` gets a back-relation: `rolPermisosCreados RolPermiso[] @relation("RolPermisoCreatedBy")`.

### 5.2 Seed behavior (idempotent)

Runs as part of Prisma migration (add to `scripts/migrate-from-sqlite.ts` + `prisma/seed.ts` — both hit this):

1. Upsert every `Permiso` in the catalog by `codigo`.
2. If a rol named `Administrador` exists, grant it `admin.all`.
3. If a rol named `Pañolero` exists, grant it the historical implicit set:
   - `maquinaria.view`, `inventario.view`, `inventario.movimiento.create`, `compras.view`, `compras.recepcion.create`, `mantenimiento.view`, `ot.view`, `listados.view`.
4. Never revoke — seed only **adds** permisos. Once an admin starts editing, the seed stops clobbering their choices.

The catalog lives in `lib/permisos/catalog.ts` as the single source of truth for both seed and UI.

### 5.3 Multi-tenant future-proofing

To later make this multi-tenant, we add `tenantId` to `Rol` (and `Usuario`). `Permiso` codes stay global. `RolPermiso` needs no change because it cascades via `Rol`. Not building this now, but verifying it's cheap.

### 5.4 Bootstrap safety

- Seed guarantees every `Administrador` has `admin.all`. The permission editor UI **locks** the `admin.all` checkbox for the `Administrador` rol — admins can't accidentally strip themselves.
- The editor also refuses to save a change that would leave the app with zero users holding `admin.all` (server-side check: at least one `Usuario` with `estado='activo'` must remain on a rol with `admin.all`).

## 6. Server API

Extends `lib/rbac.ts`. Keeps existing signatures backwards-compatible during the migration.

```ts
// NEW
export function hasPermission(session: Session | null | undefined, codigo: string): boolean;
export function requirePermission(session, codigo): asserts session is Session;
export function permisosOf(session): string[];

// KEPT (backwards-compat wrappers during migration; removed in Slice C cleanup)
export function isAdmin(session): boolean  // = hasPermission(session, 'admin.all')
export function requireAdmin(session)
```

Behavior:
- `hasPermission` returns `true` if the session holds `admin.all` OR the exact codigo.
- `permisosOf` returns the array from the JWT, or `[]` if unauthenticated.

### Auth.js plumbing

Two touches:

1. **`lib/auth.ts`** — at `authorize` time, after looking up the usuario + rol, also load `rolPermiso` rows and add `permisos: string[]` to the returned user object.
2. **`lib/auth.config.ts`** — `jwt` callback persists `permisos` into the token; `session` callback exposes it on `session.user.permisos`.

Size on wire: ~38 permisos × ~30 chars ≈ 1 KB per JWT. Fine.

### Cache invalidation

When an admin edits a rol's permisos, existing JWTs for users in that rol carry stale data until they re-login. Acceptable for v1 — document it. Post-cutover enhancement: store a `rolVersion` integer, bump on edit, invalidate sessions whose `token.rolVersion` < current on next request.

## 7. Screens

### 7.1 Roles list page — existing, small additions

`/listados/roles` already renders. Additions:
- Each row's kebab menu gains a **"Editar permisos"** action → `/listados/roles/[id]/permisos`.
- Row shows a count `N permisos` next to `N usuarios`.

### 7.2 Permission editor — new

`/listados/roles/[id]/permisos` — admin-only (`listados.roles.manage` permiso).

```
┌───────────────────────────────────────────────────────────────────┐
│ Rol: Mecánico                                    [← Volver]       │
│ 8 permisos activos · 3 usuarios con este rol                      │
│ ─────────────────────────────────────────────────────────────────│
│                                                                   │
│  Maquinaria                          [ Seleccionar todos ]       │
│    ☑ Ver listado y detalle                                        │
│    ☐ Crear nueva máquina                                          │
│    ☐ Editar ficha                                                 │
│    ☐ Dar de baja                                                  │
│    ☐ Gestionar tipos y estructura                                 │
│    ☐ Configurar columnas                                          │
│                                                                   │
│  Inventario                          [ Seleccionar todos ]       │
│    ☑ Ver listado y detalle                                        │
│    ☐ Alta de ítem                                                 │
│    ☐ Editar ítem                                                  │
│    ☐ Dar de baja                                                  │
│    ☑ Registrar movimientos (entrada/salida)                       │
│    ☐ Ajuste de stock                                              │
│    ☐ Importar / Exportar XLSX                                     │
│                                                                   │
│  [… remaining módulos collapsed by default; click to expand …]   │
│                                                                   │
│ ─────────────────────────────────────────────────────────────────│
│                              [Cancelar]    [Guardar cambios]     │
└───────────────────────────────────────────────────────────────────┘
```

- **Layout:** one `Card` per módulo, collapsed or expanded via disclosure. Module header shows `N/M permisos` count + a "Seleccionar todos" link. Checkboxes are Tailwind + shadcn `Checkbox`.
- **`Administrador` rol override:** all checkboxes disabled with a banner `El rol Administrador siempre tiene todos los permisos — no editable.`
- **`admin.all` checkbox:** hidden from every non-admin rol's editor (it's an umbrella, not a toggle).
- **Unsaved-changes indicator:** the page header shows a dot + `Cambios sin guardar` pill when dirty. `Guardar cambios` is disabled until dirty.
- **Save:** single server action that computes the diff (adds + removes) and applies in one `prisma.$transaction`. On success, toast `Permisos actualizados — los usuarios verán los cambios en su próximo login.` (explicit callout about the JWT staleness gotcha).
- **Error states:**
  - `forbidden` — current user lost `listados.roles.manage` mid-edit.
  - `last_admin_guarded` — trying to remove the last `admin.all` holder's rol permiso.
  - `stale` — the rol changed on the server since the page loaded (diff based on `updatedAt`).
- **Empty state:** new rol with zero permisos renders all checkboxes unchecked. No special empty card.

### 7.3 Sidebar (unchanged for v1)

Sidebar stays as-is — every authenticated user sees every module. Enforcement happens at the server-action level and at page-level redirects (same pattern as today's `/estadisticas/proveedores` admin redirect). Rationale: mirror current behavior exactly during the refactor; sidebar filtering is a UX polish we can add later without another migration. Role label (line 26) switches from hardcoded `"Administrador" : "Usuario"` to `session.user.rol?.nombre ?? "Usuario"`.

### 7.4 Action-button visibility

Every `+ Nuevo X`, `Editar`, `Eliminar`, etc. button that today is gated behind `isAdmin` switches to a specific `hasPermission` check. Example pattern (current → new):

```tsx
// Before
{isAdmin && <Button onClick={handleCreate}>+ Nueva máquina</Button>}

// After
{hasPermission(session, "maquinaria.create") && <Button …>+ Nueva máquina</Button>}
```

Server actions do the same substitution with `requirePermission`.

## 8. Slicing

Two PRs. Fast path.

### Slice A — Foundation (PR #1)

Schema + seed + API + JWT + permission editor UI. No call-site migration yet — the old `isAdmin`/`isPañolero` still runs every existing gate, so no user-visible regression risk.

- Prisma migration for `Permiso` + `RolPermiso` + back-relations.
- `lib/permisos/catalog.ts` with the 38 codes.
- Seed logic in `prisma/seed.ts` and `scripts/migrate-from-sqlite.ts`.
- `hasPermission` / `requirePermission` / `permisosOf` in `lib/rbac.ts`.
- Auth.js JWT + session carry `permisos: string[]`.
- `/listados/roles/[id]/permisos` editor + server action.
- `/listados/roles` list gets the "N permisos" column + kebab menu entry.
- Sidebar's hardcoded role label becomes dynamic.

**Acceptance:** admin can open a rol's permisos page, toggle checkboxes, save, verify DB write. Next login for a user in that rol carries the updated `permisos` in session. No existing feature breaks because no call site migrated yet.

### Slice B — Migration (PR #2)

Swap all 244 call sites from `isAdmin`/`isPañolero` to `hasPermission`. Do it in one commit because the refactor is mechanical and typecheck will guarantee correctness. Sidebar and `lib/mantenimiento/estado.ts` also migrate.

Ordering inside the commit (for easier review):
1. `lib/rbac.ts`: deprecate `isPañolero` + `PANOLERO_ROL`; keep `isAdmin` as a `hasPermission(session, 'admin.all')` thin wrapper (used in 100+ places, churn not worth it this PR).
2. Modules in dependency order: listados → maquinaria → inventario → compras → mantenimiento → OT → estadísticas.
3. `components/app/sidebar.tsx` filter logic.
4. Remove `PANOLERO_ROL` constant + `isPañolero` export.

**Acceptance:** typecheck + lint clean. Smoke-test the two roles we ship with (Administrador, Pañolero) — same behavior as before. Create a third test rol `Mecánico` with only `maquinaria.view` + `inventario.view` + `mantenimiento.create` + `mantenimiento.view`; verify that user sees only those three sidebar items and gets `forbidden` on admin actions.

## 9. Risks + open questions

- **JWT staleness.** Permission changes don't take effect until next login. v1-acceptable with a UI warning. Flag in post-cutover backlog as a candidate for `rolVersion` invalidation if ops pain emerges.
- **Deletion of `Administrador` rol.** Already blocked by "rol in use" check. Also blocked by the last-admin guard in §5.4. Belt-and-suspenders.
- **`compras.requisicion.create` isn't currently gated** — any authenticated user can create a requisición today. After migration, a user without `compras.requisicion.create` gets forbidden. Breaking change if some legacy user relied on it. Likely acceptable (Cervi only has admins + 1 pañolero) but verify with user before shipping Slice B.
- **"Ver detalle" vs "Ver listado".** Catalog collapses both into one `view` permiso per módulo. If Cervi later wants "can see the list but not individual invoice contents", we split later — not now.
- **Catalog vs reality drift.** New features must add their permisos to `lib/permisos/catalog.ts` AND the seed AND the editor UI. Add a `npm run lint:permisos` check later that greps for `requirePermission('foo.bar')` and asserts `'foo.bar'` appears in the catalog. Post-cutover.
