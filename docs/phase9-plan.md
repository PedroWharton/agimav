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

## TANDA 1 — Pre-cutover (bugs / fixes de UX)

Cada ítem = 1 commit. `npm run typecheck` + `npm run lint` limpio. QA en navegador antes de cerrar.

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

### WS-A · Costos y precios pendientes
Ítems: OC sin precio (resolución completa), facturas/remitos, precios pendientes.
- Probe: cuántos insumos/recepciones quedarían sin precio en datos legacy.
- Schema: flag `precioPendiente` en líneas de OC / RecepciónDetalle / MantenimientoInsumo / OtInsumo.
- **Completar sin factura:** acción en recepción que registra el precio pagado sin crear Factura (escribe `PrecioHistorico`, marca el remito "completado sin factura").
- **Propagación:** al cargar una Factura, completar los precios pendientes de la OC, recepción e insumos de mantenimiento/OT vinculados.
- **Pantalla de pendientes:** lista todos los ítems con precio pendiente, con carga manual.
- Recepciones: dropdown de proveedor (depende de este rediseño remito/factura).

### WS-B · Modelo organizacional + permisos por UP
Ítem: merge Localidad / Unidad Productiva.
- Probe: relación real Localidad↔UP en `flota7.db` (¿1:1?).
- Migración: mover FKs de Localidad (Proveedor, OrdenTrabajo, UnidadProductiva) a Unidad Productiva; eliminar Localidad de Listados y del schema.
- UP con type-to-filter en todos los selectores.
- RBAC: tabla `UsuarioUnidadProductiva`; scoping row-level (hoy `lib/rbac.ts` es solo por rol) — los usuarios ven/editan solo datos de sus UPs. Extiende la Fase 8 de permisos.

### WS-C · Trabajo sin máquina
Ítems: rework OT, movimientos diarios, servicios externos.
- **Servicios externos:** tabla nueva + entidad de proveedor de servicios; ligable a Mantenimiento y OT.
- **OT rework:** acercar OT a Mantenimiento (insumos, servicios externos, fecha programada + duración día-completo, categorías con "Otros"); sin máquina.
- **Movimientos diarios:** registro liviano tipo OT simplificada. Mixto por ítem: cada línea consumible (salida de stock) o herramienta (con devolución que reintegra al stock).

### WS-D · Mantenimiento — revisiones
Ítem: revisión = mismo mantenimiento.
- Tabla nueva `MantenimientoRevision` (fechaProgramada, estado hecha/pendiente, fechaRealizada, notas).
- Reemplazar la lógica de mantenimiento-hijo (`actions.ts:437-472`) por alta de N revisiones sobre el mismo registro.
- Migración: convertir los mantenimientos-hijo existentes (`revisionDeId`) en filas de revisión del padre.

### WS-E · Dashboard — métricas por usuario
Ítem: KPI gasto por usuario + revisión del legacy.
- Probe del legacy `Agimav23b.py`: revisar el detalle "por usuario" (totalizar + detalle) para replicar la lógica.
- KPI "Gasto por usuario" para trazabilidad de qué pide cada uno.
- Caveat: todas las facturas legacy traen `usuario='Sistema'` — la métrica nace vacía y se llena con datos nuevos post-cutover.

---

## Notas de coordinación

- WS-C y WS-D agregan estados/tipos nuevos → conviene hacerlos junto con la normalización de `estado` a enums (backlog, días 30–60) para no acumular drift de strings.
- Movimientos diarios y "gasto por usuario" ya figuraban en `post-cutover-backlog.md`; este plan los in-scopea formalmente.
