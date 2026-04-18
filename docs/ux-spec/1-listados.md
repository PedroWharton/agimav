# UX Spec 1 — Listados (master data)

Scope: CRUD for the seven master-data entities that every other module depends on. This is the warm-up module — it establishes the reusable table/form/delete/audit patterns every later module (Inventario, Maquinaria, Compras, Mantenimiento, OTs) will reuse. Getting these patterns right here saves rebuilding them seven times.

## 1. Purpose & user

Give the `Administrador` role a place to maintain the reference data that feeds every other screen, and give everyone else a read-only view of that same data so they can look things up without asking an admin.

- **Primary actor:** `Administrador` — creates/edits/soft-deletes master records.
- **Secondary actors:** all other roles — read-only access to the same pages (so a `Mecánico` can confirm a supplier's CUIT, a `Pañolero` can check which localidades exist, etc.).
- **Primary job-to-be-done:** "I need to add a new supplier / a new unit / change a user's role without asking IT."
- **Why it matters:** the seven entities here are FK targets for ~20 other tables. Bad data here (duplicate proveedores, missing localidades, typo'd roles) propagates everywhere. This spec sets the bar for how all CRUD in the app behaves.

## 2. Scope & shipping plan

Seven entities, three mergeable slices. Each slice ships independently (spec → build → review → merge → next).

### Slice A — Simple four (PR #1)

Single-field entities, identical UX pattern, no FKs pointing outward from their forms.

| Entity | Fields | Form UX | Delete |
|---|---|---|---|
| `Rol` | `nombre` | Dialog | Block-on-FK (Usuarios reference it) |
| `UnidadMedida` | `nombre`, `abreviacion` | Dialog | Block-on-FK |
| `TipoUnidad` | `nombre` | Dialog | Block-on-FK |
| `Localidad` | `nombre` | Dialog | Block-on-FK |

### Slice B — Usuario (PR #2)

Multi-field + auth implications (password set/reset, role selection, soft-delete via `estado`).

### Slice C — Proveedor + UnidadProductiva (PR #3)

Rich forms with FKs (Proveedor → Localidad; UnidadProductiva → Localidad + TipoUnidad). Proveedor additionally has fiscal fields that feed OC PDFs in Phase 5, so data quality here has downstream impact.

## 3. Schema touches (pre-build)

Before any UI lands, add the audit columns that Phase 1 promised "consistently" but only put on `Rol` and `Usuario`. New Prisma migration adds `createdAt` / `updatedAt` to five models:

- `UnidadMedida`
- `Localidad`
- `TipoUnidad`
- `UnidadProductiva`
- `Proveedor`

Also add `createdBy Int?` (FK → `Usuario`) to all seven listados models, populated by Server Actions from the session. `created_by` is nullable to tolerate legacy rows (imported from SQLite where no author is known).

Delete columns: the schema already has `estado` on `Usuario` and `Proveedor`. No new columns needed for soft delete — we flip `estado` to `"inactivo"`. The other five entities have no `estado` and use block-on-FK instead.

## 4. Screens

Every listados entity follows the same page shape. Wireframes below show Proveedor (richest) and Rol (simplest); the five in between sit on this spectrum.

### 4.1 List page — rich (`/listados/proveedores`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Proveedores                               [+ Nuevo proveedor]   │
│ Listado de proveedores con datos fiscales.                      │
│ ─────────────────────────────────────────────────────────────── │
│ [Buscar… 🔎]        [Estado ▾ Activos]        57 resultados     │
│ ─────────────────────────────────────────────────────────────── │
│ Nombre ▲         │ CUIT          │ Localidad   │ Estado │ ⋯    │
│ ─────────────────────────────────────────────────────────────── │
│ Agroquímica XYZ  │ 30-12345678-9 │ Buenos Aires│ Activo │ ⋯    │
│ Bertotto         │ 30-98765432-1 │ Colonia     │ Activo │ ⋯    │
│ …                                                               │
└─────────────────────────────────────────────────────────────────┘
```

- **Page header** (`PageHeader` component, owned by this spec): title + one-line description + primary action button (hidden for non-admins).
- **Filter row**: search input (debounced, filters on name/CUIT/email), estado filter (`Activos` | `Inactivos` | `Todos`, default `Activos`), result count.
- **Table** (TanStack Table + shadcn `Table` primitive): sortable columns, default sort by `nombre` asc. Row click → open edit Sheet (admin) or read-only Sheet (non-admin). Kebab menu per row: `Editar`, `Desactivar` (or `Eliminar` for block-on-FK entities).
- **Empty state**: centered illustration-free card `No hay proveedores aún. Creá el primero.` with CTA button (admin only).
- **Loading state**: skeleton rows (TanStack's `isLoading` flag against 8 skeleton placeholders).
- **No results state** (filter active): `No hay resultados para "xyz". Probá otra búsqueda.`

### 4.2 List page — simple (`/listados/roles`)

```
┌─────────────────────────────────────────────────────────┐
│ Roles                                    [+ Nuevo rol]  │
│ Roles del sistema utilizados para permisos.             │
│ ─────────────────────────────────────────────────────── │
│ [Buscar… 🔎]                             8 resultados   │
│ ─────────────────────────────────────────────────────── │
│ Nombre ▲              │ Usuarios │ Creado       │ ⋯    │
│ ─────────────────────────────────────────────────────── │
│ Administrador         │ 3        │ 2025-12-14   │ ⋯    │
│ Mecánico              │ 8        │ 2025-12-14   │ ⋯    │
│ …                                                       │
└─────────────────────────────────────────────────────────┘
```

- Same shell as rich list. Simpler columns. `Usuarios` column shows ref-count (so admins know before clicking Eliminar that a role is in use).

### 4.3 Edit Sheet (Proveedor, Usuario, UnidadProductiva)

Side sheet (`Sheet`, `side="right"`, `sm:max-w-lg`) for entities with 3+ fields.

```
┌───────────────────────────────────────┐
│ Editar proveedor                    × │
├───────────────────────────────────────┤
│                                       │
│  Nombre *                             │
│  [Agroquímica XYZ_____________]       │
│                                       │
│  CUIT                                 │
│  [30-12345678-9_______________]       │
│                                       │
│  Condición IVA                        │
│  [Responsable Inscripto ▾]            │
│                                       │
│  Localidad                            │
│  [Buenos Aires ▾]                     │
│                                       │
│  Email                                │
│  [contacto@agroq.com__________]       │
│                                       │
│  Teléfono                             │
│  [+54 11 1234 5678____________]       │
│                                       │
│  Dirección                            │
│  [Av. Siempre Viva 123________]       │
│                                       │
│  Dirección fiscal                     │
│  [(mismo que dirección)_______]       │
│                                       │
│  Contacto                             │
│  [Juan Pérez__________________]       │
│                                       │
│  Estado                               │
│  ( ) Activo  ( ) Inactivo             │
│                                       │
│  Creado 2025-12-14 por admin          │
│  Editado hace 3 días por admin        │
│                                       │
├───────────────────────────────────────┤
│                  [ Cancelar ] [ Guardar ] │
└───────────────────────────────────────┘
```

- Fields marked `*` are required. All others optional — most of Cervi's legacy data has sparse fiscal fields.
- Audit strip at the bottom (relative time + actor) — muted, readonly, always rendered for edit mode; absent for create mode.
- Footer: sticky; `Cancelar` (variant=outline), `Guardar` (primary, disabled until dirty+valid). Unsaved-changes guard: if the user clicks away with a dirty form, an AlertDialog asks `¿Descartar cambios?`.
- Non-admin viewers get the same Sheet but all inputs `readOnly`, no footer actions, no close-dialog guard.

### 4.4 Edit Dialog (Rol, UnidadMedida, TipoUnidad, Localidad)

Modal dialog for 1-2 field forms. Centered, focused, snappier than a sheet.

```
┌────────────────────────────────────────┐
│ Editar unidad de medida             ×  │
├────────────────────────────────────────┤
│ Nombre *                               │
│ [Kilogramo__________________]          │
│                                        │
│ Abreviación *                          │
│ [kg_________________________]          │
│                                        │
│ Creada 2025-12-14 por admin            │
├────────────────────────────────────────┤
│                 [Cancelar] [Guardar]   │
└────────────────────────────────────────┘
```

### 4.5 Usuario-specific: password management

Usuario form (Sheet) has an extra section:

```
┌───────────────────────────────────────┐
│ Credenciales                          │
│ ─────────────────────────────────────  │
│ [ Asignar contraseña temporal      ]  │   ← Create mode: required
│ [ Restablecer contraseña           ]  │   ← Edit mode: optional button
│                                       │
│ (When clicked:)                       │
│ ┌─────────────────────────────────┐   │
│ │ Contraseña temporal             │   │
│ │ [••••••••••]  [Generar]         │   │
│ │ El usuario deberá cambiarla al  │   │
│ │ ingresar por primera vez.       │   │
│ └─────────────────────────────────┘   │
└───────────────────────────────────────┘
```

- **Create mode:** admin must set a temp password before saving (required). `Generar` button produces a 12-char random string, shown in plain text **once** so the admin can copy it and share out-of-band.
- **Edit mode:** password section collapsed by default (edits typically change name/email/role, not password). Clicking `Restablecer contraseña` expands the same widget.
- **First-login change:** deferred to a future spec. For v1, the temp password just works until manually rotated. Flag: add a `mustChangePassword` boolean later if we see users never rotating.
- Password never rendered after save. No "show current password" affordance (it's hashed).

### 4.6 Delete confirmation (`AlertDialog`)

Two variants depending on entity type.

**Soft delete (Usuario, Proveedor):**

```
┌──────────────────────────────────────────┐
│ ¿Desactivar a "Juan Pérez"?              │
│                                          │
│ El usuario no podrá iniciar sesión pero  │
│ sus registros históricos se conservan.   │
│ Podés reactivarlo más tarde.             │
│                                          │
│              [Cancelar] [Desactivar]     │
└──────────────────────────────────────────┘
```

**Block-on-FK (Rol, UnidadMedida, TipoUnidad, Localidad, UnidadProductiva):**

```
┌──────────────────────────────────────────┐
│ ¿Eliminar el rol "Mecánico"?             │
│                                          │
│ Esta acción no se puede deshacer.        │
│                                          │
│              [Cancelar] [Eliminar]       │
└──────────────────────────────────────────┘
```

If the Server Action detects a FK dependency (via Prisma P2003 error), the delete fails and a toast renders:

```
No se puede eliminar "Mecánico": 8 usuarios tienen este rol.
Reasignalos primero.
```

Destructive button variant uses `variant="destructive"` (maps to `bg-destructive`). Primary action is the destructive one — it has focus by default so Enter confirms (matches native OS dialogs).

## 5. User flows

### 5.1 Admin creates a new supplier

1. Admin clicks `+ Nuevo proveedor` on `/listados/proveedores`.
2. Edit Sheet opens in create mode. Form empty. `Nombre` focused.
3. Admin types name, optionally fills CUIT/IVA/localidad/etc.
4. Clicks `Guardar`. Server Action validates via zod → `prisma.proveedor.create`.
5. On success: sheet closes, row appears at top of table (default sort), toast `Proveedor "X" creado.`
6. On validation error: inline field errors render, focus moves to first error field, sheet stays open.
7. On unique-violation (duplicate name): toast `Ya existe un proveedor con ese nombre.` Form preserved.

### 5.2 Admin soft-deletes a user

1. Admin opens the Usuario row's kebab menu → `Desactivar`.
2. AlertDialog shown with explanation + name.
3. Admin clicks `Desactivar`.
4. Server Action: `prisma.usuario.update({ estado: "inactivo" })`.
5. Toast `Usuario "Juan Pérez" desactivado.`
6. Table refreshes (Next.js `revalidatePath`). Default filter is `Activos`, so the row disappears. Switching to `Inactivos` shows it with a `Reactivar` action instead of `Desactivar`.

### 5.3 Admin tries to delete a rol in use

1. Admin opens Rol row kebab → `Eliminar`.
2. AlertDialog shown. Admin confirms.
3. Server Action attempts `prisma.rol.delete({ where: { id } })` inside try/catch.
4. Prisma throws P2003 (FK violation).
5. Server Action catches, queries `prisma.usuario.count({ where: { rolId: id } })` for the friendly message, returns error.
6. Toast: `No se puede eliminar "Mecánico": 8 usuarios tienen este rol. Reasignalos primero.`
7. Row stays. Admin can either reassign those users first or leave the rol in place.

### 5.4 Non-admin views the suppliers page

1. `Mecánico` clicks `Listados` in sidebar → lands on `/listados` (redirects to `/listados/proveedores` by default, or renders a listados index — decide in build).
2. Page renders the same table. No `+ Nuevo` button. Kebab menus absent. Row click opens Sheet in readonly mode.
3. User can search and filter, but no writes anywhere.

### 5.5 Admin resets a user's password

1. Admin opens Usuario Sheet in edit mode.
2. Clicks `Restablecer contraseña` → widget expands.
3. Clicks `Generar` → a 12-char password is populated and displayed in plaintext.
4. Admin clicks `Guardar`. Server Action: bcrypt-hashes + updates `passwordHash`.
5. Toast: `Contraseña actualizada. Copiala antes de cerrar — no se mostrará de nuevo.` (Password was already visible in the form; the toast is just a nudge.)
6. Next time the user logs in, the new password works. (First-login mandatory change is out of scope for Phase 2.)

## 6. Components

### 6.1 New shadcn primitives to install

| Component | Why |
|---|---|
| `table` | List rendering |
| `badge` | Estado chip, ref-count pills |
| `select` | Estado filter, FK pickers (localidad, rol) |
| `alert-dialog` | Delete confirmations |
| `form` (react-hook-form wrapper) | Form scaffolding with zod integration |
| `tooltip` | Audit metadata hover, truncated cell content |
| `checkbox` | Not used in Phase 2 but needed early; cheap to add |

Already installed: `dialog`, `sheet`, `button`, `input`, `label`, `card`, `avatar`, `separator`, `dropdown-menu`, `sonner`.

### 6.2 Reusable domain components (owned by this spec)

These establish patterns reused by every later module. Build them carefully.

| Component | Path | Responsibility |
|---|---|---|
| `PageHeader` | `components/app/page-header.tsx` | Title + description + primary action slot. |
| `DataTable<T>` | `components/app/data-table.tsx` | TanStack Table + shadcn Table. Props: `columns`, `data`, `isLoading`, `emptyState`, `searchPlaceholder`, `onRowClick`. No column config UI in Phase 2 (no per-user column hiding) — revisit in Phase 4. |
| `FormSheet` | `components/app/form-sheet.tsx` | Sheet wrapper for rich forms. Props: `open`, `onOpenChange`, `title`, `description`, `isDirty`, `onSubmit`, children. Handles unsaved-changes guard. |
| `FormDialog` | `components/app/form-dialog.tsx` | Same contract as FormSheet but Dialog-based. |
| `ConfirmDialog` | `components/app/confirm-dialog.tsx` | AlertDialog wrapper. Props: `open`, `onConfirm`, `title`, `description`, `confirmLabel`, `destructive`. |
| `AuditMeta` | `components/app/audit-meta.tsx` | Two-line muted strip: `Creado {relTime} por {nombre}` · `Editado {relTime} por {nombre}`. Date formatter via `date-fns` locale `es`. |
| `EntityForm` | `components/listados/<entity>-form.tsx` | Per-entity field layout; owns the zod schema + defaultValues + react-hook-form register. |
| `ActionsMenu` | `components/app/actions-menu.tsx` | Row kebab → `Editar`, `Desactivar`/`Eliminar`. Hidden entirely for non-admins. |

### 6.3 Server Actions (per entity)

One file per entity under `app/(app)/listados/<entity>/actions.ts`:

```ts
"use server";
export async function createProveedor(input: unknown) { … }
export async function updateProveedor(id: number, input: unknown) { … }
export async function softDeleteProveedor(id: number) { … }  // flips estado
export async function reactivateProveedor(id: number) { … }
// (for block-on-FK entities, use `deleteRol` etc. instead of soft delete)
```

All actions:
1. `await auth()` — reject if no session.
2. Check `session.user.rol === "Administrador"` — reject if not.
3. zod-parse input — return field errors on failure.
4. Prisma call inside try/catch — catch P2002 (unique), P2003 (FK), rethrow others.
5. `revalidatePath("/listados/<entity>")`.
6. Return `{ ok: true }` or `{ ok: false, error, fieldErrors? }`.

### 6.4 Zod schemas

One per entity, colocated with the form:

```ts
// components/listados/proveedor-form.tsx
const proveedorSchema = z.object({
  nombre: z.string().min(1).max(200),
  cuit: z.string().regex(/^\d{2}-\d{8}-\d$/).optional().or(z.literal("")),
  condicionIva: z.enum(["Responsable Inscripto", "Monotributo", "Exento", "Consumidor Final"]).optional(),
  localidadId: z.coerce.number().int().positive().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telefono: z.string().max(50).optional(),
  direccion: z.string().max(300).optional(),
  direccionFiscal: z.string().max(300).optional(),
  nombreContacto: z.string().max(200).optional(),
  estado: z.enum(["activo", "inactivo"]).default("activo"),
});
```

CUIT format enforced only when non-empty. Cervi's legacy data has lots of empty CUITs.

## 7. Data model touch

Read/write per slice:

| Slice | Models read | Models written |
|---|---|---|
| A (simple four) | `Rol`, `UnidadMedida`, `TipoUnidad`, `Localidad`, plus `Usuario.count` for Rol ref-count | same |
| B (Usuario) | `Usuario`, `Rol`, `Usuario.count({rolId})` | `Usuario` |
| C (Proveedor + UnidadProductiva) | `Proveedor`, `Localidad`, `TipoUnidad`, ref-counts from `OrdenCompra`, `Factura`, `PrecioHistorico`, `MantenimientoInsumo`, `Mantenimiento`, `OrdenTrabajo` | `Proveedor`, `UnidadProductiva` |

Migrations added before slice A lands:

1. `20260418_xxxx_listados_audit_columns` — adds `created_at` / `updated_at` defaults to `unidades_medida`, `localidades`, `tipos_unidad`, `unidades_productivas`, `proveedores`.
2. `20260418_xxxx_listados_created_by` — adds nullable `created_by` FK to all seven listados tables pointing at `usuarios(id)`.

Migration script `migrate-from-sqlite.ts` re-run after the schema change still works: all new columns are nullable or defaulted.

## 8. States & edge cases

| State | Behavior |
|---|---|
| No data yet (empty list) | Empty-state card with CTA (admin) or bland message (non-admin). |
| Loading (server fetch in flight) | Skeleton rows. Never a full-screen spinner. |
| Search returns 0 | `No hay resultados para "…". Probá otra búsqueda.` with clear-filters button. |
| Form dirty + user closes Sheet | AlertDialog confirms discard. |
| Form submit pending | Submit button shows spinner + disabled; form inputs disabled. |
| Duplicate unique value | P2002 caught, field-level error `Ya existe.` on the offending field. |
| FK violation on delete (block-on-FK) | Toast with dependency count + friendly message. |
| Soft-delete a user who's the session's own | Block with toast `No podés desactivarte a vos mismo.` |
| Soft-delete the last Administrador | Block with toast `No podés desactivar al último administrador.` |
| Concurrent edit (two admins open same record) | Last-write-wins for Phase 2. Optimistic locking deferred to Phase 5 (OC pipeline) where it actually matters. |
| Network failure on save | Toast `No se pudo guardar. Reintentá en unos segundos.` Form preserved. |
| Non-admin reaches `/listados/...` | Page renders read-only (table + readonly Sheet). No server-side redirect. |
| Non-admin POSTs directly to Server Action | Action checks role → returns `{ ok: false, error: "forbidden" }`. Client shows generic toast. |
| Password weaker than minimum | zod rejects `< 8` chars. No strength meter in v1. |
| Search with accents | Postgres `ILIKE` + `unaccent` extension — enable in migration alongside audit columns. |
| Very long name (200+ chars) | Truncate in table with `max-w-xs truncate` + Tooltip showing full value on hover. |
| Rol rename | Editing a rol's `nombre` immediately flows to session (next time user logs in). No cascade needed (Usuario references `rolId`, not name). |

## 9. i18n keys

Namespace `listados.*` under `messages/es.json`:

```
listados.index.titulo                  "Listados"
listados.index.descripcion             "Datos maestros del sistema"
listados.common.buscar                 "Buscar…"
listados.common.crear                  "Nuevo"
listados.common.editar                 "Editar"
listados.common.guardar                "Guardar"
listados.common.guardando              "Guardando…"
listados.common.cancelar               "Cancelar"
listados.common.desactivar             "Desactivar"
listados.common.reactivar              "Reactivar"
listados.common.eliminar               "Eliminar"
listados.common.campoRequerido         "Este campo es obligatorio"
listados.common.resultados             "{count, plural, one {# resultado} other {# resultados}}"
listados.common.sinResultados          "No hay resultados para \"{query}\""
listados.common.vacio                  "No hay {entidad} aún"
listados.common.estadoActivo           "Activo"
listados.common.estadoInactivo         "Inactivo"
listados.common.filtroEstado           "Estado"
listados.common.filtroTodos            "Todos"
listados.common.audit.creado           "Creado {fecha} por {actor}"
listados.common.audit.editado          "Editado {fecha} por {actor}"
listados.common.descartarCambios       "¿Descartar cambios sin guardar?"
listados.common.errorGuardar           "No se pudo guardar. Reintentá en unos segundos."
listados.common.errorEliminarFK        "No se puede eliminar \"{nombre}\": {count} {entidadDep} lo usan. Reasignalos primero."
listados.common.duplicado              "Ya existe {entidad} con ese nombre"
listados.roles.titulo                  "Roles"
listados.roles.descripcion             "Roles del sistema para permisos"
listados.roles.singular                "rol"
listados.roles.plural                  "roles"
listados.unidadesMedida.titulo         "Unidades de medida"
listados.unidadesMedida.descripcion    "Unidades usadas en inventario y compras"
listados.unidadesMedida.campos.nombre         "Nombre"
listados.unidadesMedida.campos.abreviacion    "Abreviación"
listados.tiposUnidad.titulo            "Tipos de unidad productiva"
listados.localidades.titulo            "Localidades"
listados.usuarios.titulo               "Usuarios"
listados.usuarios.descripcion          "Usuarios del sistema y sus roles"
listados.usuarios.campos.nombre        "Nombre"
listados.usuarios.campos.email         "Email"
listados.usuarios.campos.rol           "Rol"
listados.usuarios.campos.estado        "Estado"
listados.usuarios.password.asignar     "Asignar contraseña temporal"
listados.usuarios.password.restablecer "Restablecer contraseña"
listados.usuarios.password.generar     "Generar"
listados.usuarios.password.aviso       "El usuario deberá cambiarla al ingresar."
listados.usuarios.errores.noAutoBaja   "No podés desactivarte a vos mismo"
listados.usuarios.errores.ultimoAdmin  "No podés desactivar al último administrador"
listados.proveedores.titulo            "Proveedores"
listados.proveedores.descripcion       "Listado de proveedores con datos fiscales"
listados.proveedores.campos.nombre     "Nombre"
listados.proveedores.campos.cuit       "CUIT"
listados.proveedores.campos.condicionIva      "Condición IVA"
listados.proveedores.campos.localidad  "Localidad"
listados.proveedores.campos.email      "Email"
listados.proveedores.campos.telefono   "Teléfono"
listados.proveedores.campos.direccion  "Dirección"
listados.proveedores.campos.direccionFiscal   "Dirección fiscal"
listados.proveedores.campos.contacto   "Contacto"
listados.unidadesProductivas.titulo    "Unidades productivas"
listados.unidadesProductivas.campos.nombre      "Nombre"
listados.unidadesProductivas.campos.localidad   "Localidad"
listados.unidadesProductivas.campos.tipo        "Tipo"
```

Conventions unchanged from Phase 0: camelCase keys, Rioplatense voseo for imperatives (`reasignalos`, `probá`, `podés`).

## 10. Nav + routing

- `lib/nav.ts` already has a `Listados` entry from Phase 0 pointing at `/listados`. Extend it: that top-level route becomes an index page that either:
  - **(A)** Redirects to the first sub-page (`/listados/proveedores` — the most-used).
  - **(B)** Renders a grid of 7 cards, one per entity, each linking to its page.
  - **Recommendation: (B)** — it doubles as a quick landing that scales when we add more listados later.
- Sub-routes: `/listados/{roles,unidades-medida,tipos-unidad,localidades,usuarios,proveedores,unidades-productivas}`.
- Breadcrumb in topbar: `Listados / Proveedores`. (Topbar already shows module title; breadcrumbs are a Phase 2 addition to `components/app/topbar.tsx`.)

## 11. Role-based access

For this spec:

- **Read:** all authenticated roles.
- **Write:** only `Administrador`.
- **Enforcement layers** (defense in depth):
  1. **Server Actions:** check `session.user.rol === "Administrador"` first thing. Reject otherwise. This is the real gate.
  2. **UI:** hide `+ Nuevo`, kebab menu, Save button, and use readonly inputs when `!isAdmin`. Computed once per page via `await auth()` in the server component.
  3. **Middleware:** no per-route role check yet. The UI/Server-Action pair is sufficient for Phase 2 without complicating `proxy.ts`.

Helper: `lib/rbac.ts` exports `isAdmin(session)` and `requireAdmin(session)`. Every Server Action in listados starts with `requireAdmin(await auth())`.

## 12. Acceptance checklist

### Per slice

- [ ] UX spec deviations (if any) documented back into this file.
- [ ] Prisma migration for audit columns + `created_by` applied cleanly to dev.
- [ ] `pnpm db:migrate-legacy` re-run end-to-end clean with the schema change.
- [ ] `pnpm typecheck` + `pnpm lint` clean.
- [ ] Admin can CRUD every entity in the slice.
- [ ] Non-admin sees read-only views, no write affordances rendered.
- [ ] Non-admin calling Server Action directly returns `forbidden`.
- [ ] Soft delete / block-on-FK semantics behave per §4.6.
- [ ] Search + estado filter + sort + empty states all verified manually.
- [ ] Audit strip renders correct relative time in Spanish.
- [ ] i18n: no missing-key warnings in dev; all keys under `listados.*`.
- [ ] Playwright smoke: admin creates → edits → deactivates → reactivates a record.

### After slice C (module done)

- [ ] All seven entities live at their routes.
- [ ] Reusable components (`DataTable`, `FormSheet`, `FormDialog`, `ConfirmDialog`, `AuditMeta`, `PageHeader`) documented in a short `components/app/README.md` so Phase 3 picks them up without rediscovery.
- [ ] Screenshot review with stakeholder before starting Phase 3.

## 13. Out of scope

- **Bulk actions** (multi-select rows + bulk deactivate). Rare in listados; defer.
- **Import from Excel / CSV.** Listados data doesn't churn enough to warrant this. Inventario (Phase 3) will need it.
- **Column configuration per user** (hide/show/reorder). Defer to Phase 4 where the Maquinaria table has many more columns.
- **Audit log view** (who changed what, when). Phase 2 tracks `created_by` but shows only last-edit metadata. A full audit trail UI is a later module.
- **Password policies / complexity requirements / expiry / lockout.** v1 enforces min length only.
- **SMTP / password-reset emails.** Admin-sets-temp is the only flow.
- **Mandatory first-login password change.** Deferred (see §4.5).
- **Optimistic locking on concurrent edits.** Defer to Phase 5.
- **Pagination.** All seven tables fit in memory: 8 roles, 4 unidades_medida, 9 localidades, 7 tipos_unidad, 32 usuarios, 44 unidades_productivas, 57 proveedores. Client-side filter/sort against the full dataset is fine. Revisit if any table passes ~500 rows.
- **Export to Excel.** Not a v1 need for listados.
- **Mobile layout.** Desktop-first, per foundation spec.

## 14. Build order

Pre-work (before PR #1):
1. Add migrations for audit columns + `created_by`.
2. Install shadcn primitives: `table`, `badge`, `select`, `alert-dialog`, `form`, `tooltip`, `checkbox`.
3. Build reusable components (`PageHeader`, `DataTable`, `FormSheet`, `FormDialog`, `ConfirmDialog`, `AuditMeta`, `ActionsMenu`).
4. Build `lib/rbac.ts` + extend topbar with breadcrumbs.
5. Build `/listados` index page (grid of 7 cards).

Slice A (PR #1): Rol → UnidadMedida → TipoUnidad → Localidad (same pattern, copy-paste-adapt).

Slice B (PR #2): Usuario (new territory — password flow, self-deactivate guard, last-admin guard).

Slice C (PR #3): Proveedor (richest form), then UnidadProductiva (FK picker practice for Phase 3).
