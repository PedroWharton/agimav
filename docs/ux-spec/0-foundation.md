# UX Spec 0 — Foundation

Scope: the shell every module plugs into. No business logic, no domain data. This spec defines what "the app looks like before any feature is built" — tokens, layout chrome, nav, and the login door.

## 1. Purpose & user

Give every Cervi user a consistent, authenticated workspace before any domain work exists.

- **Actors:** all eight roles (`Administrador`, `Mecánico`, `Electrico`, `Metalurgico`, `Ingeniero`, `Mantenimiento`, `Pañolero`, `Recorredor`). Phase 0 treats them uniformly — role-gated nav comes in Phase 2 (Listados).
- **Primary job-to-be-done:** log in, see the eight modules, click one, see "Próximamente", log out.
- **Why it matters:** locks in the visual language and routing conventions that every later spec builds on. Getting this wrong is expensive to retrofit.

## 2. Screens

### 2.1 Login (`/login`)

```
┌────────────────────────────────────────────────┐
│                                                │
│              ┌──────────────────┐              │
│              │ AGIMAV            │              │
│              │ Iniciar sesión    │              │
│              │ Ingresá tus cred… │              │
│              │                   │              │
│              │ Email             │              │
│              │ [____________]    │              │
│              │ Contraseña        │              │
│              │ [____________]    │              │
│              │                   │              │
│              │ [ Entrar       ]  │              │
│              └──────────────────┘              │
│                                                │
└────────────────────────────────────────────────┘
  bg: muted/30   card: w-full max-w-sm
```

- Centered card on `bg-muted/30`.
- Header: uppercase brand tag (`app.nombre`), `CardTitle` with `auth.login.titulo`, `CardDescription` with subtitle.
- Form fields labeled in Spanish, native HTML validation (`required`, `type="email"`).
- Submit button full width. Label flips `Entrar` → `Entrando…` while pending.
- Error state: single line `text-destructive` above submit with `auth.login.error`.

### 2.2 App shell (all `/app/(app)/*` routes)

```
┌──────────┬───────────────────────────────────────┐
│          │ topbar                          [avatar▾]
│          ├───────────────────────────────────────┤
│ AGIMAV   │                                       │
│ ──────── │                                       │
│ Maquin.  │                                       │
│ Invent.  │           module content              │
│ Compras  │                                       │
│ Mantto.  │                                       │
│ OT       │                                       │
│ Estad.   │                                       │
│ Listado  │                                       │
│ Opciones │                                       │
│          │                                       │
└──────────┴───────────────────────────────────────┘
  w-60        flex-1
```

- **Sidebar** (`w-60`, `bg-sidebar`, `border-r`): brand block at top, eight nav items with Lucide icons, active route highlighted with `bg-sidebar-accent`.
- **Topbar** (`h-14`, `border-b`): module title on the left (derived from route), Avatar dropdown on the right showing initials; dropdown contains name + email header, separator, "Cerrar sesión" form that posts to `signOut`.
- **Main** (`flex-1`, `overflow-auto`, `p-6`): scrollable region that hosts module pages.

### 2.3 Placeholder module (`/maquinaria`, `/inventario`, …)

```
┌────────────────────────────────────────┐
│ Maquinaria               [Próximamente]│
│ ─────────────────────────────────────  │
│ Catálogo de máquinas, estructura       │
│ jerárquica por tipo y horómetros.      │
└────────────────────────────────────────┘
```

Single `Card`. Title = module name (i18n `nav.*`), muted badge `Próximamente`, description = `placeholder.descripcionModulo.*`.

## 3. User flows

### 3.1 First login

1. User opens any URL → `proxy.ts` (Auth.js middleware) redirects to `/login` because no session.
2. User types email + password → submits.
3. `loginAction` calls `signIn("credentials", …)` with `redirectTo: "/maquinaria"`.
4. On success, session cookie set, redirect to `/maquinaria`.
5. On `AuthError`, form re-renders with `error: "invalid"` → shows `auth.login.error`.

### 3.2 Navigation

1. Authenticated user lands on `/maquinaria` (root `/` redirects there).
2. Clicks any sidebar item → client-side nav to that module.
3. Active item highlighted via `usePathname()` comparison.

### 3.3 Logout

1. User clicks avatar → dropdown opens.
2. Clicks "Cerrar sesión" → form posts, server action calls `signOut({ redirectTo: "/login" })`.
3. Session cookie cleared, user lands on `/login`.

### 3.4 Deep-link while logged out

1. User opens `/compras/requisiciones/42` without a session.
2. Middleware's `authorized` callback returns `false` → Auth.js redirects to `/login`.
3. After login, user is redirected to `/maquinaria` (Phase 0 does not preserve original `callbackUrl` — to revisit later).

## 4. Components

Phase 0 consumes shadcn primitives only. No domain components yet.

| Component | Source | Purpose |
|---|---|---|
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | shadcn | Login card, placeholder modules |
| `Button` | shadcn | Submit, logout |
| `Input`, `Label` | shadcn | Login fields |
| `Avatar`, `AvatarFallback` | shadcn | Topbar identity |
| `DropdownMenu*` | shadcn | Avatar menu |
| `Separator` | shadcn | Inside dropdown |
| `Sonner` (`Toaster`) | shadcn | Global toast mount (no usage in Phase 0) |
| Lucide icons | `lucide-react` | Nav glyphs (`Truck`, `Package`, `ShoppingCart`, `Wrench`, `ClipboardList`, `BarChart3`, `List`, `Settings`) |

Custom (thin) wrappers owned by this spec:

- `components/app/sidebar.tsx` — client, reads `usePathname` + `useTranslations("nav")`
- `components/app/topbar.tsx` — server, reads `await auth()` + `await getTranslations()`
- `components/app/placeholder-module.tsx` — server, pure presentational
- `lib/nav.ts` — `navItems: { href, icon, labelKey }[]` — **single source of truth** for nav. Later phases extend this array, never fork it.

## 5. Data model touch

Minimum viable schema for login:

- `Rol { id, nombre (unique), createdAt, updatedAt }`
- `Usuario { id, nombre, email (unique), passwordHash, rolId?, estado ("activo"|"inactivo"), createdAt, updatedAt }`

Seed creates the 8 roles (matching Python's hard-coded list) + an `Administrador` user `admin@cervi.local` / `cambiar123` (password to be rotated before any production use).

No other Prisma models in Phase 0. Phase 1 adds the rest of the 38 tables.

## 6. States & edge cases

| State | Behavior |
|---|---|
| Unauthenticated deep-link | Middleware redirects to `/login`. |
| Login pending | Inputs + button `disabled`; button label "Entrando…". |
| Login invalid creds | `text-destructive` error line, fields preserved by browser, focus stays on form. |
| Login unexpected error | Thrown up; Next.js error boundary displays default error UI. (Custom error page deferred.) |
| Logged-in user visits `/login` | Phase 0: login page still renders. Not worth building the redirect now. Revisit once we have real users. |
| User with `estado="inactivo"` | `authorize()` returns `null` → same "invalid" error. No separate UX for disabled accounts yet. |
| Missing translation key | `next-intl` throws in dev; surfaces early during review. |
| Small viewport (<768px) | Not designed for Phase 0. Cervi runs this on desktops/laptops. Mobile polish is out of scope. |
| Route matches no module | Next.js 404 default. No custom 404 yet. |

## 7. i18n keys

Namespace tree (Spanish only, `messages/es.json`):

```
app.nombre                    "Agimav"
app.tagline                   (reserved; unused in Phase 0)
nav.maquinaria                "Maquinaria"
nav.inventario                "Inventario"
nav.compras                   "Compras"
nav.mantenimiento             "Mantenimiento"
nav.ordenesTrabajo            "Órdenes de Trabajo"
nav.estadisticas              "Estadísticas"
nav.listados                  "Listados"
nav.opciones                  "Opciones"
nav.cerrarSesion              "Cerrar sesión"
auth.login.titulo             "Iniciar sesión"
auth.login.subtitulo          "Ingresá tus credenciales para continuar"
auth.login.email              "Email"
auth.login.password           "Contraseña"
auth.login.submit             "Entrar"
auth.login.submitting         "Entrando…"
auth.login.error              "Email o contraseña incorrectos"
auth.logout.titulo            "Cerrar sesión"
placeholder.proximamente      "Próximamente"
placeholder.descripcionModulo.<modulo>   (one per module)
```

Conventions:

- camelCase for keys, lowercase Spanish values.
- Each module gets its own top-level namespace starting in Phase 2 (`listados.*`, `inventario.*`, …).
- Rioplatense voseo (`ingresá`, `cargá`) where imperatives appear — matches how Cervi users speak.

## 8. Design tokens

All tokens live in `app/globals.css` as `oklch()` variables under `:root` and `.dark`. Dark mode is defined but not toggleable in Phase 0 — we ship light-only and add the switcher when a real need surfaces.

### Colors (the roles)

| Token | Role | Used for |
|---|---|---|
| `background` / `foreground` | Page surface | `<body>` |
| `card` / `card-foreground` | Elevated surface | `Card`, login box, placeholder modules |
| `muted` / `muted-foreground` | Quiet surfaces + secondary text | Descriptions, placeholder badges |
| `primary` / `primary-foreground` | Main action | Submit button, active CTA |
| `secondary` / `secondary-foreground` | Neutral action | (reserved for later) |
| `accent` / `accent-foreground` | Hover state, subtle highlights | Nav hover |
| `destructive` | Errors, delete | Login error, future delete buttons |
| `border`, `input`, `ring` | Lines + focus | Every bordered surface |
| `sidebar*` | Sidebar-specific neutrals | Sidebar bg + active item (`sidebar-accent`) |
| `chart-1…5` | Data viz | Reserved for Phase 7 |

Never hardcode hex. Always use token utility classes (`bg-card`, `text-muted-foreground`, `border-border`, `bg-sidebar`, …).

### Typography

- `font-sans`: Geist (loaded via `next/font`) — body + headings.
- `font-mono`: Geist Mono — IDs, OC numbers, tabular data.
- Type scale: Tailwind defaults. Shell uses `text-sm` for nav, `text-2xl` for `CardTitle`, `text-xs uppercase tracking-wider` for the brand tag.

### Spacing

Tailwind 4 default scale. Conventions for Phase 0:

- Card interior padding: `p-6` (shadcn default).
- Sidebar nav items: `px-3 py-2`, `gap-3` between icon and label.
- Topbar: `h-14 px-6`.
- Main content: `p-6`.

### Radius

Token ladder: `--radius: 0.625rem` → `rounded-md/lg/xl/2xl/3xl/4xl` derived from it. Use `rounded-lg` for cards, `rounded-md` for inputs and buttons (shadcn defaults).

### Density

Comfortable by default. Data-heavy tables in Phases 3+ will need a compact variant — flag for those specs.

## 9. Shell layout rules

- Route groups: `(auth)` for logged-out chrome, `(app)` for logged-in chrome. Each has its own `layout.tsx`.
- `app/page.tsx` is a 1-liner `redirect("/maquinaria")`.
- Every `(app)` page renders inside the shell; never build a full-bleed page without opting out via a nested layout.
- Server components by default. Mark client (`"use client"`) only when needed (`sidebar.tsx` for `usePathname`, `login-form.tsx` for `useActionState`).

## 10. Auth wiring (for reference)

- **Edge config:** `lib/auth.config.ts` — providers `[]`, JWT strategy, `authorized` callback guards everything except `/login`, `/api/auth/*`, and `/favicon.ico`.
- **Node config:** `lib/auth.ts` — composes `authConfig` + Credentials provider with Prisma lookup + bcrypt compare.
- **Middleware:** `proxy.ts` at repo root (Next 16 renamed `middleware.ts` → `proxy.ts`).
- **Route handlers:** `app/api/auth/[...nextauth]/route.ts` re-exports `handlers.GET/POST`.
- Session shape extended: `session.user.id` (string), `session.user.rol` (string | null).

## 11. Out of scope for Phase 0

- All domain pages (placeholders only).
- Role-based authorization (everyone sees the same nav).
- Password reset, "forgot password", account creation flows.
- Dark mode toggle (CSS exists; no switcher).
- Mobile layout (desktop-first; reassess later).
- Preserving `callbackUrl` across login redirects.
- Custom 404 / error pages.
- Notifications, banners, announcements.
- i18n locale switcher (Spanish is the only locale).
- Analytics, telemetry, Sentry wiring (Phase 8).

## 12. Acceptance checklist

- [ ] `/login` renders the card and authenticates seeded admin.
- [ ] Unauthenticated deep-link → `/login`.
- [ ] After login, `/maquinaria` renders inside the shell.
- [ ] All 8 nav items route to their placeholder and highlight active state.
- [ ] Avatar dropdown shows name + email; "Cerrar sesión" returns to `/login`.
- [ ] No hardcoded colors — every surface uses token classes.
- [ ] `pnpm typecheck` + `pnpm lint` clean.
- [ ] No console errors or missing-key warnings from `next-intl` in dev.
