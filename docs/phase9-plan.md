# Fase 9 — Plan de correcciones del QA

> Origen: QA end-to-end completo realizado por el usuario el 2026-05-21, previo al cutover de Fase 8. Se relevaron ~19 ítems entre bugs y features. Este doc es el plan acordado.

## Decisiones acordadas

- **Secuencia:** los bugs / fixes de UX bloqueantes se hacen **antes del cutover** (Tanda 1). Las features grandes se difieren a **Fase 9 post-cutover** (workstreams A–E).
- **Revisión de mantenimiento:** sub-revisiones sobre el *mismo* mantenimiento (tabla nueva), no se crean mantenimientos hijo.
- **Precios pendientes:** la factura propaga el precio automáticamente + pantalla manual para "completar sin factura".
- **Localidad / Unidad Productiva:** se elimina Localidad → merge a Unidad Productiva + permisos por UP.
- **Movimientos diarios:** mixto por ítem — cada línea es consumible (salida de stock) o herramienta (con devolución que la reintegra).

## Suposiciones (vigentes salvo corrección)

- Aprobar borrador **no elimina** el estado "En Revisión" — queda como paso opcional.
- Nº de orden interna = campo manual en la **Requisición** (el campo `numeroOrdenInterna` ya existe en el schema), se muestra heredado en la OC.
- Notas en OC = **nota por línea** + observaciones de cabecera, visibles al emitir.
- "Día completo" en OT / movimientos = se saca la hora del día, queda fecha + duración estimada.
- Servicios externos = **entidad nueva** (proveedor de servicios), separada del Proveedor de insumos.
- KPI "Gastos" = renombrar y ampliar a gasto total (incluye costos cargados sin factura).
- Categorías de OT = catálogo configurable en Listados, con opción "Otros".

---

## TANDA 1 — Pre-cutover (bugs / fixes de UX) — ✅ COMPLETADA

Los 12 ítems se implementaron, QA-aron y shippearon a `main` (commits `dfb3808`–`ec2b9c9`).
Cutover realizado el 2026-05-21.

Cada ítem = 1 commit. `npm run typecheck` + `npm run lint` limpio.

| # | Ítem | Esf. | Detalle |
|---|---|---|---|
| 1 | Aprobar desde Borrador | S | Permitir `approveSolicitud` con estado = "Borrador" (no solo "En Revisión"); `solicitudes/actions.ts:357`. "En Revisión" queda opcional. |
| 2 | OC sin precio (básico) | S | Permitir emitir OC con líneas sin precio; marcar la línea como precio pendiente. La resolución del precio va en WS-A. |
| 3 | Tablero default + filtros | S | `tablero` como vista por defecto en `mantenimientos-client.tsx`; etiquetar filtros ("Tipo: Todos", "Estado: Todos"). |
| 4 | Plantilla — tipo libre | S | No forzar `tipo="preventivo"` al aplicar plantilla (form + `plantillas/actions.ts:359`); el usuario elige. |
| 5 | Recepciones — UX | S | Sacar el link a la OC; "volver" siempre a `/compras/recepciones`; modal para editar "quién recibe" en el detalle. |
| 6 | Notas en OC | S-M | Nota por línea (`OrdenCompraDetalle.nota` nuevo) + exponer `observaciones` de cabecera en el form de OC. |
| 7 | Nº orden interna | S | Exponer `Requisicion.numeroOrdenInterna` en el form de requisición; mostrarlo en la OC. |
| 8 | Crear item desde OC | M | `allowCreate` en el combobox de `detalle-lines-editor.tsx` + modal de alta rápida de item de inventario. |
| 9 | Crear mant. iniciado/finalizado | M | Opción de estado inicial en el form: Pendiente / En Reparación / Finalizado (con campos de cierre si Finalizado). |
| 10 | Dashboard — limpieza | S | Quitar "OTIF Proveedores" y "Heatmap Correctivos por Máquina"; renombrar KPI "Facturación del Mes" → "Gastos". |
| 11 | Doble botón seleccionar máquina | S | En `mantenimiento/nuevo`, `machine-chip.tsx` envuelve un `MaquinariaCombobox` dentro de un Popover → doble selector. Fix: sacar el popover+botón y mostrar el combobox directo. |
| 12 | Crear niveles de maquinaria | M-L | UI para crear/editar niveles + toggle `esPrincipal` en atributos. Alcance acotado: alta de niveles al final del árbol; reparenting/insertar-en-medio queda fuera (backlog "Nivel reparenting"). Confirmado necesario para el cutover. |

---

## FASE 9 — Post-cutover (workstreams)

Cada WS: spec-first (`docs/ux-spec/`), probe de datos si aplica, migración Prisma, luego slices mergeables.

### WS-A · Costos y precios pendientes — ✅ COMPLETADA
Slices A1–A4 shippeados a `main` (commits `a8d390e`–`3ae6058`).
- **A1** — migración (`precioUnitario?` en RecepciónDetalle, `precioPendiente` en MantenimientoInsumo/OtInsumo) + completar recepción sin factura registrando el precio.
- **A2** — flag `precioPendiente` por insumo en el detalle de mantenimiento; los pendientes no suman al costo.
- **A3** — al cargar una factura se resuelven los insumos de mantenimiento con precio pendiente del ítem.
- **A4** — pantalla `/compras/precios-pendientes` con resolución manual.
- Pendiente de WS-C: cablear `OtInsumo.precioPendiente` (la columna ya existe).

Ítems: OC sin precio (resolución completa), facturas/remitos, precios pendientes.
- Probe: cuántos insumos/recepciones quedarían sin precio en datos legacy.
- Schema: flag `precioPendiente` en líneas de OC / RecepciónDetalle / MantenimientoInsumo / OtInsumo.
- **Completar sin factura:** acción en recepción que registra el precio pagado sin crear Factura (escribe `PrecioHistorico`, marca el remito "completado sin factura").
- **Propagación:** al cargar una Factura, completar los precios pendientes de la OC, recepción e insumos de mantenimiento/OT vinculados.
- **Pantalla de pendientes:** lista todos los ítems con precio pendiente, con carga manual.
- Recepciones: dropdown de proveedor (depende de este rediseño remito/factura).

### WS-B · Modelo organizacional + permisos por UP — ✅ COMPLETADA
Slices B1+B2 (`5699c43`) y B3 (`875da7b`) shippeados a `main`. Las migraciones
`20260522020000_ws_b_drop_localidad` y `20260522030000_ws_b3_usuario_unidad_productiva`
quedan **pendientes de `migrate deploy` a producción** — ver
`docs/runbook-migraciones-pendientes.md`.

- **B1+B2** — eliminada la tabla `localidades`. `localidad` es texto plano en
  UnidadProductiva/Proveedor/OrdenTrabajo; los selectores de FK pasaron a
  combobox de texto libre sembrados con `lib/localidades.getLocalidadesSugeridas()`.
- **B3** — tabla `UsuarioUnidadProductiva` + `lib/up-scope.ts`
  (`accessibleUpIds`/`canAccessUp`). Filtro row-level en los listados **y** el
  detalle de Mantenimiento y OrdenTrabajo. UI de admin en
  `/listados/usuarios/[id]/unidades`. Decisiones confirmadas y aplicadas:
  filtra Mantenimiento + OT; un usuario sin asignaciones ve todo (opt-in).
- El probe `scripts/ws-b-probe.ts` se eliminó (ya cumplido; sondeaba la tabla
  `localidades`, que ya no existe).

Ítem: merge Localidad / Unidad Productiva.

**Probe (`scripts/ws-b-probe.ts`, corrido el 2026-05-22 contra Postgres):**
- 9 Localidades → 44 UPs. Cardinalidad **1:muchos real** (El Chañar 13 UPs, Neuquén 11). NO es 1:1 — el plan original asumía mal.
- Proveedor: 57, 25 con localidadId. OrdenTrabajo: 30, 26 con localidadId, 23 con UP, **0 discrepancias** (`ot.localidad` ⇔ `up.localidad`, derivable).
- MovimientoDiario: 217 filas, solo 11 usan `localidad_id` (columna huérfana, sin relación); 206 usan el texto `localidad`.
- Requisicion (154) ya usa `localidad`/`unidadProductiva` como **texto libre**, no FK.
- Usuarios: 34 activos.

**Decisión confirmada por el usuario (2026-05-22):**
- **Eliminar la tabla `localidades`.** `localidad` pasa a ser texto plano (`localidad String?`) en `UnidadProductiva`, `Proveedor` y `OrdenTrabajo`. Se pierde el catálogo editable de 9 ciudades (aceptado).
- **RBAC per-UP:** tabla `UsuarioUnidadProductiva` (asignación individual de UPs, hasta 44 por usuario).

#### Slice B1+B2 — eliminar Localidad ✅ (`5699c43`)
B1 (schema) y B2 (barrido de código) van juntos: dropear la tabla rompe el build hasta que el código deje de referenciar `prisma.localidad`.

**Migración SQL** (`prisma/migrations/<ts>_ws_b_drop_localidad/migration.sql`) — borrador validado contra el probe:
```sql
-- 1. columnas de texto nuevas
ALTER TABLE "unidades_productivas" ADD COLUMN "localidad" TEXT;
ALTER TABLE "proveedores"          ADD COLUMN "localidad" TEXT;
ALTER TABLE "ordenes_trabajo"      ADD COLUMN "localidad" TEXT;
-- 2. backfill desde la tabla localidades
UPDATE "unidades_productivas" u SET "localidad" = l.nombre
  FROM "localidades" l WHERE u.localidad_id = l.id;
UPDATE "proveedores" p SET "localidad" = l.nombre
  FROM "localidades" l WHERE p.localidad_id = l.id;
UPDATE "ordenes_trabajo" o SET "localidad" = l.nombre
  FROM "localidades" l WHERE o.localidad_id = l.id;
-- 3. dropear FKs + columnas
ALTER TABLE "unidades_productivas" DROP CONSTRAINT IF EXISTS "unidades_productivas_localidad_id_fkey";
ALTER TABLE "unidades_productivas" DROP COLUMN "localidad_id";
ALTER TABLE "proveedores" DROP CONSTRAINT IF EXISTS "proveedores_localidad_id_fkey";
DROP INDEX IF EXISTS "proveedores_localidad_id_idx";
ALTER TABLE "proveedores" DROP COLUMN "localidad_id";
ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT IF EXISTS "ordenes_trabajo_localidad_id_fkey";
ALTER TABLE "ordenes_trabajo" DROP COLUMN "localidad_id";
-- 4. columna huérfana de movimientos_diarios (ya tiene texto `localidad`)
ALTER TABLE "movimientos_diarios" DROP COLUMN "localidad_id";
-- 5. dropear la tabla
DROP TABLE "localidades";
```

**Schema (`prisma/schema.prisma`):**
- Borrar el modelo `Localidad` entero.
- `Usuario`: borrar la relación `localidadesCreadas Localidad[]`.
- `UnidadProductiva`: sacar `localidadId` + relación `localidad`; agregar `localidad String?`.
- `Proveedor`: sacar `localidadId` + relación + `@@index([localidadId])`; agregar `localidad String?`.
- `OrdenTrabajo`: sacar `localidadId` + relación; agregar `localidad String?`.
- `MovimientoDiario`: sacar `localidadId`.
- Después: `npm run db:generate`.

**Barrido de código (inventario del Explore, 42 archivos):**
- **Borrar** `app/(app)/listados/localidades/` (page.tsx, localidades-client.tsx, actions.ts).
- **Forms** Proveedor / UnidadProductiva / OrdenTrabajo: el selector de localidad pasa de combobox-sobre-tabla a combobox de texto sembrado con los `distinct` de la columna `localidad` existente, `allowCreate` true (mismo patrón que el texto-libre de Inventario/Requisicion).
- **Includes** `localidad: { select: { nombre } }` sobre `unidadProductiva` → leer el campo `localidad` directo (mantenimiento `[id]`/`nuevo`/`plantillas`, OT pages).
- Reemplazar todos los `prisma.localidad.findMany()` por `distinct` sobre las columnas de texto (proveedores, UPs, OT, solicitudes, inventario, listados dashboard).
- `listados/page.tsx`: sacar el KPI/conteo de localidades.
- i18n: borrar `listados.localidades.*` (es+en); revisar labels sueltos.
- Scripts: `parity-check.ts` saca `localidades` de la lista de tablas; `migrate-from-sqlite.ts` ya no aplica post-cutover (dejar nota o no tocar).
- `components/app/breadcrumbs.tsx`: sacar la entrada `localidades`.

#### Slice B3 — RBAC per-UP ✅ (`875da7b`)
- Modelo `UsuarioUnidadProductiva` (usuarioId, unidadProductivaId, `@@unique([usuarioId, unidadProductivaId])`) — migración aditiva.
- `lib/rbac.ts`: helpers `accessibleUpIds(session)` / `canAccessUp(session, upId)`; admin bypassa el scoping.
- UI de admin para asignar UPs a usuarios (en el área de usuarios/roles).
- **Decisiones abiertas para B3 (confirmar al empezar):** (a) qué entidades se filtran row-level — Mantenimiento y OrdenTrabajo tienen FK de UP; Maquinaria NO tiene UP; Compras usa UP-texto. (b) política del usuario sin asignaciones: ¿ve todo o no ve nada?

### WS-C · Trabajo sin máquina — ✅ COMPLETADA
Slices C1–C5 shippeados a `main` (commits `d18c085`–`a649fb0`). Migraciones
`20260522040000`–`20260522070000` **pendientes de `migrate deploy`** — ver
`docs/runbook-migraciones-pendientes.md`.

- **C1 `d18c085`** — Servicios externos: modelos `ProveedorServicio` (catálogo)
  y `ServicioExterno` (línea). Listado/CRUD en `/listados/proveedores-servicio`.
- **C2 `e12efd2`** — Panel de servicios externos compartido, cableado en el
  detalle de Mantenimiento y de OT (alta/edición/baja, flag precio pendiente).
- **C3 `3101d6b`** — Categorías de OT: modelo `CategoriaOt` + FK en
  `ordenes_trabajo`; listado en `/listados/categorias-ot`; siembra "Otros".
- **C4 `481aeaa`** — OT rework: `fechaProgramada` + `duracionDias`; categoría,
  programación y precio pendiente de insumos en form/detalle; el calendario
  ploteea por fecha programada.
- **C5 `a649fb0`** — Movimientos diarios: tabla legacy plana reagrupada en
  cabecera + líneas; módulo `/movimientos-diarios` con líneas mixtas
  consumible/herramienta e integración de stock (salida, devolución, reverso).

Decisiones confirmadas por el usuario (2026-05-22): servicios externos =
catálogo completo + líneas; movimientos diarios = cabecera + líneas.

**Probe (`scripts/ws-ce-probe.ts`, 2026-05-22 contra Postgres):** OT 30 filas
(ya sin máquina); MovimientoDiario 217 filas, todas un log plano de compras
(sector=Compras, ninguna herramienta) — la mecánica herramienta/devolución
nace vacía. Proveedores sin campo que distinga "servicios".

### WS-D · Mantenimiento — revisiones — ✅ COMPLETADA
Ítem: revisión = mismo mantenimiento.
- **D1 ✅** (`516fc73`) — tabla `MantenimientoRevision` + migración aditiva. `transitionEstado`: finalizar con revisión programada crea una fila de revisión sobre el mismo registro, no un mantenimiento-hijo. Decisión: los hijos existentes (`revisionDeId`) se conservan como históricos — sin migración destructiva.
- **D2 ✅** — UI en el detalle del mantenimiento:
  - Panel "Revisiones" en la columna principal: lista `mantenimiento.revisiones` (fecha programada, estado, descripción, fecha realizada); badge pendiente/hecha; marcar hecha / reabrir / eliminar por fila.
  - Diálogo "Agregar revisión": fecha + descripción + opción "Repetir" (cantidad + cada X días/meses → genera N filas espaciadas).
  - Acciones nuevas en `mantenimiento/actions.ts`: `agregarRevisiones`, `marcarRevisionHecha`, `eliminarRevision` (no bloquean en estado terminal — las revisiones se agendan post-finalización).
  - `page.tsx`: carga la relación `revisiones`; se sacó `revisionesHijas`/`revisionHija` y los campos legacy `programarRevision`/`fechaProximaRevision`/`descripcionRevision` del payload del cliente.
  - `mantenimiento-detail-client.tsx`: se reemplazó la tarjeta "Revisión programada" del sidebar por el panel nuevo; se sacó el toast `childId`. El diálogo finalizar queda igual (crea la fila desde D1).
  - i18n `mantenimiento.revision.*` reescrito.

### WS-E · Dashboard — métricas por usuario — ✅ COMPLETADA
Slice E1 `43bca93` shippeado a `main`. Sin migración (solo código).

- **E1** — Subpágina `/estadisticas/usuarios`: tabla por usuario que combina el
  gasto facturado (`Factura.usuario`) con la actividad de pedidos
  (`Requisicion.solicitante`), mergeando nombres normalizados. KPIs, top 10,
  export XLSX, selector de rango. Gated por `estadisticas.proveedores.view`.
- Decisión confirmada (2026-05-22): la métrica sale de facturas + requisiciones.
- Caveat vigente: las facturas legacy traen `usuario='Sistema'` (39 filas); ya
  aparecen usuarios reales post-cutover. La subpágina muestra una nota al
  respecto — la métrica se llena con datos nuevos.

---

## Notas de coordinación

- WS-C y WS-D agregan estados/tipos nuevos → conviene hacerlos junto con la normalización de `estado` a enums (backlog, días 30–60) para no acumular drift de strings.
- Movimientos diarios y "gasto por usuario" ya figuraban en `post-cutover-backlog.md`; este plan los in-scopea formalmente.
