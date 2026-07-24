# Runbook — aplicar migraciones pendientes (WS-A / WS-D / WS-B)

Escrito 2026-05-22. Todos los comandos se corren desde la raíz del repo.

## Contexto — estado de la base al 2026-05-22

Hay **una sola base Neon** (`neondb` en `ep-morning-bird-aejmvo5r…`, la del `.env.local`)
y es **producción**. `prisma migrate status` mostró que:

- Faltan aplicar: `20260522000000_ws_a_precio_pendiente`, `20260522010000_ws_d_mantenimiento_revision`.
  Ambas son **aditivas y no destructivas** (ver más abajo).
- La base tiene 2 migraciones que **no están en `main`**: `20260513_110000_agente_ia_skeleton`
  y `20260513_120000_agente_usuario_view`. Pertenecen a la rama sin mergear `feat/asistente-ia`
  (feature "asistente IA", **pausada**). Crearon 4 tablas `agente_*`, la vista `usuario_safe`
  y el rol Postgres `agente_app`. Ese drift es **esperado** — ver la sección final.

## ✅ Paso 0 — Seguridad: el rol `agente_app` (HECHO 2026-05-22)

La migración `agente_ia_skeleton` había creado el rol con un password placeholder:

```sql
CREATE ROLE agente_app LOGIN PASSWORD 'CHANGE_ME_BEFORE_DEPLOY';
```

Era un login válido a la base de producción con una clave conocida (está en el git de la
rama). Como la feature está pausada y había 0 conexiones activas, se deshabilitó el login:

```sql
ALTER ROLE agente_app NOLOGIN;   -- aplicado 2026-05-22; rolcanlogin quedó en f
```

Cuando se retome `feat/asistente-ia`, revertir con una clave fuerte **y** actualizar la
config de la VM en simultáneo:

```sql
ALTER ROLE agente_app LOGIN PASSWORD '<password-fuerte-nuevo>';
```

## Paso 1 — Backup de Neon (antes de migrar)

En la consola de Neon → proyecto → branch del endpoint `ep-morning-bird-aejmvo5r`:
**Create branch** desde el estado actual. Es un punto de restauración copy-on-write
instantáneo. Nombralo p.ej. `pre-ws-a-d-2026-05-22`. (Alternativa: anotar el timestamp
para Point-in-Time Restore.)

Las dos migraciones son no destructivas, pero el branch es la disciplina mínima
antes de cualquier `migrate deploy` sobre prod.

## ✅ Paso 2 — Aplicar WS-A + WS-D (HECHO 2026-05-22)

El `DATABASE_URL` del `.env.local` apunta al endpoint **directo** (sin `-pooler` en el host),
que es el correcto para migraciones — no hace falta cambiarlo.

```bash
set -a && . ./.env.local && set +a

# confirmar qué se va a aplicar
npx prisma migrate status

# aplicar — solo corre ws_a + ws_d; las 2 de agente ya constan aplicadas
npx prisma migrate deploy
```

Esperado: aplica 2 migraciones —
`20260522000000_ws_a_precio_pendiente` y `20260522010000_ws_d_mantenimiento_revision`.

Aplicado y verificado el 2026-05-22: ambas migraciones aplicadas; las 3 columnas nuevas y
la tabla `mantenimiento_revisiones` existen en la base.

Qué hacen (todo aditivo, metadata-only, instantáneo, sin reescritura de tablas):

- `ws_a`: `ADD COLUMN recepciones_detalle.precio_unitario` (nullable);
  `ADD COLUMN mantenimiento_insumos.precio_pendiente` y `ot_insumos.precio_pendiente`
  (`BOOLEAN NOT NULL DEFAULT false`).
- `ws_d`: `CREATE TABLE mantenimiento_revisiones` + índice + FK (tabla nueva, vacía).

## Paso 3 — Verificación

```bash
npx prisma migrate status
```

Debe decir **"Database schema is up to date!"**. Verificado el 2026-05-22 tras el deploy:
así quedó. El drift de `agente_ia_skeleton` / `agente_usuario_view` **no** aparece en
`migrate status` cuando no hay migraciones locales pendientes — ver la sección final.

Smoke test en la app en vivo:

- Pantalla de precios pendientes (WS-A) carga sin error.
- Detalle de un mantenimiento → panel "Revisiones" (WS-D) carga y permite agregar una revisión.

## El drift de `feat/asistente-ia` — qué hacer

`main` no tiene las 2 migraciones `agente_*`, pero la base sí. `migrate status` no lo
reporta como problema mientras no haya migraciones locales pendientes (post-deploy dice
"up to date"). Mientras la rama siga pausada, lo recomendado es **tolerar el drift**:

- `migrate deploy` (lo de este runbook) funciona igual — solo aplica hacia adelante.
- Revertir las tablas `agente_*` destruiría trabajo pausado (hay 2 sesiones y 16 filas
  de audit ya registradas). No hacerlo.
- El drift se resuelve solo cuando `feat/asistente-ia` se mergee a `main`: sus migraciones
  son del 05-13, anteriores a las de WS (05-22), así que el orden histórico queda correcto
  y Prisma las verá como ya aplicadas.

⚠️ **No correr `prisma migrate dev` contra esta base** mientras exista el drift.
`migrate dev` compara `schema.prisma` (que en `main` no tiene los modelos `agente_*`)
contra la historia y propondría **DROPear** las 4 tablas del asistente. El proyecto usa
migraciones escritas a mano + `migrate deploy`, así que esto es solo una nota de disciplina.

Si en algún momento se quiere un `migrate status` 100% limpio sin esperar al merge:
traer a `main` solo la capa de base de la rama — las 2 carpetas de migración **y** los
modelos `agente_*` + la vista en `schema.prisma` — para que schema, historia y base
coincidan. Es trabajo aparte; no es necesario para aplicar WS-A/WS-D.

## ✅ WS-B — migraciones aplicadas (verificado 2026-07-24)

WS-B (Slices B1+B2 `5699c43` y B3 `875da7b`). Sus dos migraciones **ya están
aplicadas a producción** — entraron con el mismo `migrate deploy` del 2026-05-22
que aplicó las de WS-C (verificado 2026-07-24: `prisma migrate status` reporta
23/23 migraciones aplicadas, "Database schema is up to date!"). El texto
original de esta sección quedó desactualizado. Detalle de las migraciones:

- `20260522020000_ws_b_drop_localidad` — **parcialmente destructiva**: dropea
  FKs, las columnas `localidad_id` y la tabla `localidades`. No es aditiva.
  Hace el backfill del nombre a las columnas de texto nuevas **antes** de
  dropear, así que el dato no se pierde — pero por dropear una tabla, **el
  branch de Neon de backup (Paso 1) es obligatorio** acá.
- `20260522030000_ws_b3_usuario_unidad_productiva` — aditiva, crea la tabla
  `usuario_unidades_productivas`.

Aplicar (desde la raíz del repo, mismo procedimiento que el Paso 2):

```bash
set -a && . ./.env.local && set +a

npx prisma migrate status     # confirmar que faltan las 2 de WS-B
npx prisma migrate deploy
```

Verificación:

- `migrate status` → "Database schema is up to date!".
- La tabla `localidades` ya no existe.
- `unidades_productivas`, `proveedores` y `ordenes_trabajo` tienen una columna
  `localidad` TEXT con los nombres backfilleados; ya no tienen `localidad_id`.
- Existe la tabla `usuario_unidades_productivas` (vacía).

Smoke test: abrir `/listados/proveedores` y `/listados/unidades-productivas`
(el selector de localidad es ahora un combobox de texto); abrir
`/listados/usuarios`, menú de un usuario → "Asignar unidades productivas".

## ✅ WS-C — migraciones aplicadas (HECHO 2026-05-22)

WS-C (Slices C1–C5, commits `d18c085`–`a649fb0`) — las cuatro migraciones se
aplicaron a producción el 2026-05-22. `migrate status` quedó en "Database
schema is up to date!".

**Incidente durante el deploy:** la migración `..._ws_c_movimientos_diarios`
falló en el primer intento (error `42P07`): `ALTER TABLE ... RENAME TO` no
renombra el índice de la PK, así que `movimientos_diarios_pkey` seguía ocupado
al recrear la tabla. La corrida no fue transaccional — el `RENAME` quedó
aplicado. Se recuperó con `migrate resolve --rolled-back` + una migración
corregida (commit `ae8a48b`) que libera el nombre de la PK y es idempotente.
Verificado post-deploy: 217 líneas reagrupadas en 73 cabeceras, legacy dropeada.
**Lección:** toda migración que renombre una tabla y recree otra con el mismo
nombre debe renombrar/soltar también el índice de PK y la secuencia.

Detalle original de las cuatro migraciones:

- `20260522040000_ws_c_servicios_externos` — **aditiva**: tablas
  `proveedores_servicio` y `servicios_externos`.
- `20260522050000_ws_c_categorias_ot` — **aditiva**: tabla `categorias_ot` +
  columna FK `ordenes_trabajo.categoria_id`; siembra la fila "Otros".
- `20260522060000_ws_c_ot_rework` — **aditiva**: columnas
  `ordenes_trabajo.fecha_programada` y `duracion_dias`.
- `20260522070000_ws_c_movimientos_diarios` — **parcialmente destructiva**:
  archiva la tabla plana `movimientos_diarios`, crea `movimientos_diarios`
  (cabecera) + `movimientos_diarios_lineas`, reagrupa las 217 filas legacy y
  **dropea la tabla legacy** tras el backfill. Por dropear una tabla, **el
  branch de Neon de backup (Paso 1) es obligatorio** acá.

WS-E (slice `43bca93`) **no tiene migración** — es solo código.

No hay permisos nuevos: WS-C reusa permisos existentes (`listados.*`,
`inventario.*`, `mantenimiento.update`, `ot.update`) y WS-E reusa
`estadisticas.proveedores.view`. **No hace falta correr `seed-permisos.ts`.**

Se aplicó con (desde la raíz del repo):

```bash
set -a && . ./.env.local && set +a
npx prisma migrate deploy
```

Verificado el 2026-05-22:

- `migrate status` → "Database schema is up to date!".
- `movimientos_diarios_legacy` ya no existe; `movimientos_diarios_lineas`
  tiene 217 filas reagrupadas en 73 cabeceras `movimientos_diarios`.
- Existe la tabla `categorias_ot` con la fila "Otros".

Smoke test: abrir `/listados/proveedores-servicio` y `/listados/categorias-ot`;
crear una OT con categoría y fecha programada; abrir un mantenimiento y agregar
un servicio externo; abrir `/movimientos-diarios`, crear un registro con una
línea herramienta y devolverla; abrir `/estadisticas/usuarios`.
