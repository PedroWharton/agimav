# UX Spec 5 — Mantenimiento + Órdenes de Trabajo

Scope: mantenimientos (correctivos + preventivos), plantillas, registro de horas, and órdenes de trabajo (OT). One spec because the entities share a máquina combobox, an insumos sub-flow, and a detail-page historial anchor; splitting into two specs would duplicate half the prose. Four mergeable slices. Correctivo is the load-bearing one (98% of legacy rows); everything else ships thinner.

**Not in this spec:** MTBF / cost-per-máquina analytics (Phase 7), Vercel Cron auto-generation of preventivos (defer until real plantilla adoption), OT ↔ Mantenimiento relational link (schema doesn't carry it, usage too low to justify v1 work).

## 1. Purpose & user

Give Cervi a single place to:

- open a mantenimiento when a máquina breaks (correctivo) or schedule one (preventivo), assign a responsable, track it through reparación and finalización, and see every audit event inline;
- let un taller record which insumos were actually consumed during a reparación, so Inventario stays honest and Estadísticas can compute real costo-por-máquina in Phase 7;
- capture horómetro readings as they come in from the field (light usage — legacy has 6 rows in 2 years, but those 6 rows drive the next-preventivo date calculation);
- open an OT for work that isn't tied to a specific machine (taller maintenance, welding a gate, etc.) and track insumos consumed.

- **Primary actors**
  - `Solicitante` (`Mecánico`, `Encargado`) — opens a mantenimiento, updates estado as work progresses.
  - `Responsable` (`Mecánico`) — assigned to a mantenimiento, closes it.
  - `Administrador` — creates plantillas, bulk-applies them, manages horómetro registrations.
  - `Pañolero` — is not a primary actor here (insumos consumed via mantenimiento are `salida` movements that bypass recepción; pañolero reviews the resulting inventario movements after the fact).
- **Primary job-to-be-done:** *"T-25 is broken again — who fixed it last time, what insumos did they use, and is there still oil filter stock?"* — the answer is a three-click flow from the maquinaria detail page through its mantenimiento history to the last reparación's insumos list.
- **Why it matters:** Mantenimiento writes the `salida` InventarioMovimientos that drive stock depletion. Without this module, Inventario is a read-only count. Also Phase 7 Estadísticas (MTBF, cost-per-máquina, ranking) all read from `mantenimientos` + `mantenimiento_insumos` — Phase 6 is what makes Phase 7 possible.

## 2. Reality check — what the data actually looks like today

Probe on `/Users/pedrowharton/Desktop/proyectos/agimav/flota7.db` (2026-04-19, ad-hoc SQL).

### 2.1 Volumes

| Table | Rows |
|---|---:|
| `mantenimientos` | 129 |
| `mantenimiento_historial` | 768 (avg 6 events / mantenimiento) |
| `mantenimiento_insumos` | 424 (3.3 lines / mantenimiento avg) |
| `mantenimiento_tareas` | 2 |
| `plantillas_mantenimiento` | 1 |
| `plantilla_insumos` | 2 |
| `plantilla_tareas` | 2 |
| `registro_horas_maquinaria` | 6 |
| `ordenes_trabajo` | 28 |
| `ot_insumos` | 40 |

Small volumes everywhere. No pagination virtualization needed — TanStack server-side at 50/page covers everything with room.

### 2.2 State distributions

- **`mantenimientos.estado`:** Finalizado 99 / Pendiente 12 / En Reparación — Taller 9 / Cancelado 5 / En Reparación — Chacra 4. Five-way split, no `Revisión Programada` rows in legacy even though the schema supports it.
- **`mantenimientos.tipo`:** correctivo 127 / preventivo 2. Effectively single-type.
- **`mantenimientos.prioridad`:** Media 129. **Field is dead weight** — nobody ever picks anything else.
- **`mantenimientos.es_recurrente`:** 1 for all 129 rows. Dead bit.
- **`plantilla_id` on mantenimientos:** null on all 129. Plantilla-spawned mantenimientos don't exist in production yet.
- **`frecuencia_unidad` / `metodo_calculo`:** populated only on the 2 preventivos. Everything else null.
- **`mantenimiento_historial.tipo_cambio`:** estado 358 / insumo 321 / taller 73 / observacion 14 / responsable 2. Estado + insumo changes dominate.
- **`ordenes_trabajo.estado`:** Cerrada 18 / En Curso 10. Two-state machine.
- **`ordenes_trabajo.prioridad`:** Media 26 / Alta 1 / Baja 1. Same dead-weight picker as mantenimientos.

### 2.3 Legacy gaps Phase 6 addresses

1. **Plantillas barely exist.** 1 plantilla total, 0 mantenimientos that use it. Build CRUD + "aplicar a máquina" but expect real adoption only post-cutover. No cron; manual trigger is fine for v1.
2. **Priority is noise.** Default to `Media` and hide the picker behind an "Opciones avanzadas" disclosure. One less click for the common path.
3. **`es_recurrente` is uninformative.** Drop from UI entirely; keep the column with default true for schema parity.
4. **Tareas checklist is aspirational** (2 rows total). Show the UI affordance on detail pages, but don't block state transitions on checklist completion.
5. **Historial is the real UX anchor.** 6 events per mantenimiento on average. Detail page leads with a timeline; everything else is secondary.
6. **Máquina combobox is the hard one.** ~236 máquinas across 8 tipos. Search needs to match tipo + nroSerie + principal-atributo (e.g. "J.D. 7225J / T-25"). Build once in Slice A, reuse in OT if needed.
7. **OT ↔ Mantenimiento is not linked in schema.** Roadmap mused about a 1-to-many FK; actual volumes (28 OT rows) don't justify the work. Ship them disjoint.

## 3. State machines — explicit

### 3.1 `Mantenimiento.estado`

```
  Pendiente ──(iniciar → Chacra)──▶ En Reparación — Chacra ──┐
       │                                                      │
       │                                                      ├──(finalizar)──▶ Finalizado
       │                                                      │
       └──(iniciar → Taller)──▶ En Reparación — Taller ───────┤
                                                              │
  (cancelar from any non-terminal state) ─────▶ Cancelado     │
                                                              │
  (finalizar with programarRevision=true) ─────▶ Finalizado   │
      emits a new Pendiente child with fechaProgramada        │
                                                              ▼
                                                       Revisión Programada*
```

*`Revisión Programada` is a child row, not a new state on the parent. Parent stays `Finalizado`; child is a fresh mantenimiento in `Pendiente` with `plantillaId = null` and `fechaProgramada = parent.fechaProximaRevision`.

Allowed transitions:

| From | To | Role | Side effects |
|---|---|---|---|
| Pendiente | En Reparación — Chacra | Responsable or Admin | write historial `estado`; set `fechaInicio = now` |
| Pendiente | En Reparación — Taller | Responsable or Admin | write historial `estado` + `taller` (if tallerAsignadoId set); set `fechaInicio = now` |
| En Reparación — Chacra | En Reparación — Taller | Responsable or Admin | write historial `estado` + `taller` |
| En Reparación — Taller | En Reparación — Chacra | Responsable or Admin | write historial `estado` |
| En Reparación — * | Finalizado | Responsable or Admin | write historial `estado`; set `fechaFinalizacion = now`; **commit insumos consumption** (see §4.1); if `programarRevision` emit child |
| Pendiente / En Reparación — * | Cancelado | Admin only | write historial `estado`; **do not** commit insumos; `fechaFinalizacion = now` |

Terminal: `Finalizado`, `Cancelado`. No reopening.

### 3.2 `OrdenTrabajo.estado`

Legacy is two-state. We mirror it:

```
  En Curso ──(cerrar)──▶ Cerrada
       │
       └──(cancelar)──▶ Cancelada (net-new v1 — legacy had no cancel path)
```

Allowed transitions:

| From | To | Role | Side effects |
|---|---|---|---|
| En Curso | Cerrada | Responsable or Admin | set `fechaFinalizacion = now`; **commit insumos as InventarioMovimiento salida** (see §4.4) |
| En Curso | Cancelada | Admin only | set `fechaFinalizacion = now`; no movimientos |

Terminal: `Cerrada`, `Cancelada`.

## 4. Data-model deltas & write paths

### 4.1 Insumos consumption at finalización (Mantenimiento)

Transaction boundary on `finalizar`:

```
for each mantenimientoInsumo where cantidadUtilizada > 0:
  - upsert InventarioMovimiento:
      tipo = 'salida'
      cantidad = mantenimientoInsumo.cantidadUtilizada
      moduloOrigen = 'mantenimiento'
      idOrigen = mantenimiento.id
      destino = null (not applicable for salida)
  - Inventario.stock -= cantidadUtilizada
  - Inventario.valorTotal = Inventario.stock * Inventario.valorUnitario  (recompute, don't re-weighted-avg — salida doesn't change unit cost)
  - write MantenimientoHistorial(tipo_cambio='insumo', detalle='consumido: {item} x {cant}')
commit.
```

Over-consumption (`cantidadUtilizada > Inventario.stock`) is **allowed with a warning**. Legacy doesn't block it; stock can go negative. UI flags the row but lets the save through.

### 4.2 MantenimientoHistorial write points

Every state-affecting action writes one or more historial rows:

| Action | tipo_cambio | valorAnterior | valorNuevo | detalle |
|---|---|---|---|---|
| estado transition | `estado` | prev estado | new estado | `null` |
| taller change | `taller` | prev taller name or `null` | new taller name or `null` | `null` |
| responsable change | `responsable` | prev usuario name | new usuario name | `null` |
| insumo added/edited/removed at finalización | `insumo` | `null` | `null` | `"{accion}: {item} x {cant}"` |
| observacion add | `observacion` | `null` | `null` | the observation text |

Historial is append-only — no edit, no delete from UI.

### 4.3 Tareas

Checklist on detail page. Non-blocking — does not gate state transitions. On plantilla-spawned mantenimientos, tareas are pre-populated with `esDePlantilla=true`. Users can mark `realizada=true` any time during Pendiente / En Reparación. No historial write for tarea toggles (too chatty).

### 4.4 OT insumos consumption

On `cerrar` transition:

```
for each otInsumo where cantidad > 0:
  - upsert InventarioMovimiento:
      tipo = 'salida'
      cantidad = otInsumo.cantidad
      moduloOrigen = 'ordenes_trabajo'
      idOrigen = ot.id
  - Inventario.stock -= cantidad
  - Inventario.valorTotal = Inventario.stock * Inventario.valorUnitario
commit.
```

Same over-consumption policy: warn, don't block.

### 4.5 Registro de horas

On create: `RegistroHorasMaquinaria` insert with `horasAnterior = maquinaria.horasAcumuladas`, `horasNuevo = input`, `horasDiferencia = horasNuevo - horasAnterior`. Then update `Maquinaria.horasAcumuladas = horasNuevo`. Validate `horasNuevo > horasAnterior` — reject if equal or lower (operator error). No historial table for this module — `RegistroHorasMaquinaria` itself is the audit.

### 4.6 Plantilla "aplicar a máquina"

Form: pick a Plantilla + Máquina + optional `fechaProgramada` override. Action:

```
insert Mantenimiento:
  tipo = 'preventivo'
  plantillaId = plantilla.id
  frecuenciaValor = plantilla.frecuenciaValor
  frecuenciaUnidad = plantilla.frecuenciaUnidad
  prioridad = plantilla.prioridad
  descripcion = plantilla.descripcion
  estado = 'Pendiente'
  fechaProgramada = input or now + (frecuenciaValor, frecuenciaUnidad)
  maquinariaId = input
  responsableId = <admin creating it, editable later>
for each plantillaInsumo:
  insert MantenimientoInsumo(cantidadSugerida = plantillaInsumo.cantidadSugerida, cantidadUtilizada = 0)
for each plantillaTarea:
  insert MantenimientoTarea(descripcion = plantillaTarea.descripcion, realizada = false, esDePlantilla = true, orden = plantillaTarea.orden)
```

No cron. The "generar próximos preventivos" admin button is deferred — add when first plantilla earns it.

## 5. Screens

### 5.1 `/mantenimiento` — list (Slice A)

- Topbar: title, description ("Correctivos y preventivos de las máquinas"), "Nuevo mantenimiento" button (right).
- Subnav: Mantenimientos · Plantillas · Horómetros (Slice B + C wire these in).
- Filters row: Estado (multi-select), Tipo (correctivo / preventivo — default correctivo), Máquina (Combobox), Responsable (Combobox).
- Toggle: "Incluir finalizados / cancelados" — default **off** (shows only active work).
- DataTable columns: N° · Máquina (nroSerie + tipo) · Tipo · Estado (`EstadoChip`) · Responsable · Fecha creación · Días abiertos.
- Row click → detail.
- Empty state: "Todavía no hay mantenimientos activos. Creá el primero."

### 5.2 `/mantenimiento/[id]` — detail (Slice A)

Three-column layout on desktop, stacked on mobile:

- **Left column (2/3):**
  - Back button + title ("Mantenimiento #{id} · {máquina.nroSerie}").
  - Estado chip + transition buttons (context-sensitive per §3.1).
  - Descripción (editable inline while not terminal).
  - Tareas checklist card (show even if empty; "Agregar tarea" action).
  - Insumos card: table of `MantenimientoInsumo` rows with columns code/descripción/cantidad sugerida/cantidad utilizada (editable inline)/costo unitario (read-only, derived)/costo total. "Agregar insumo" button opens combobox → add row with cantidadUtilizada=0.
  - Observaciones log (free-text append-only, writes to historial with tipo_cambio=observacion).
- **Right column (1/3):**
  - Card: Máquina, Responsable, Unidad productiva, Taller asignado (if `En Reparación — Taller`).
  - Card: Fechas — creación, inicio, finalización, programada, próxima revisión (if set).
  - Card: **Historial timeline** — reverse-chronological list of historial rows. Each entry: icon by tipo_cambio, who, when, before/after or detalle.

### 5.3 `/mantenimiento/nuevo` — create (Slice A)

- PageHeader, back to list.
- Form: Máquina (MaquinariaCombobox — the hard one), Tipo (default correctivo), Descripción (textarea), Responsable (UsuarioCombobox), Unidad productiva (optional), Fecha programada (optional, only enabled if tipo=preventivo). Prioridad hidden behind "Opciones avanzadas" disclosure (default Media).
- Submit: creates Mantenimiento with estado=Pendiente, writes initial historial row (`tipo_cambio='estado'`, valorNuevo='Pendiente').
- Redirect to detail.

### 5.4 `/mantenimiento/plantillas` — list + CRUD (Slice B)

- Subnav-visible, admin-only.
- DataTable: Nombre · Tipo maquinaria · Frecuencia · Insumos count · Tareas count. Row actions: Editar, Aplicar a máquina, Eliminar.
- "Nueva plantilla" → `/mantenimiento/plantillas/nueva`. Form: Nombre (unique), Tipo maquinaria (select from MaquinariaTipo), Frecuencia valor + unidad (select: Horas / Días / Meses), Prioridad (optional, default Media), Descripción. Below: InsumosEditor (list of item+cantidadSugerida+unidadMedida), TareasEditor (list of descripción with drag-reorder → `orden` field).
- Edit same form as create. Deleting blocked if any Mantenimiento has `plantillaId = id` (defer with error toast: "Hay mantenimientos vinculados a esta plantilla.").

### 5.5 `/mantenimiento/plantillas/[id]/aplicar` — apply (Slice B)

- Dialog-style page. Pick Máquina (MaquinariaCombobox filtered to `tipoId = plantilla.tipoMaquinariaId`). Optional: override fecha programada. Submit → create mantenimiento per §4.6, redirect to its detail page.

### 5.6 `/mantenimiento/horometros` — list + create (Slice C)

- Subnav-visible, any authenticated user can read; only Admin or Responsable can create.
- DataTable: Máquina · Fecha · Horas anterior · Horas nuevo · Diferencia · Usuario. Filter by máquina.
- "Nuevo registro" → modal form: Máquina (MaquinariaCombobox), Horas nuevo (numeric, 2 decimals). Server fills horasAnterior from current `Maquinaria.horasAcumuladas`, validates `horasNuevo > horasAnterior`, commits.
- No edit, no delete — append-only log.

### 5.7 `/ordenes-trabajo` — list (Slice D)

- Topbar with title, description, "Nueva OT" button (right).
- Filters: Estado, Solicitante, Responsable, Unidad productiva.
- DataTable: N° OT · Título · Estado · Prioridad · Responsable · Fecha creación · Fecha finalización.
- Row click → detail.

### 5.8 `/ordenes-trabajo/[id]` — detail (Slice D)

- Two columns:
  - Left: Título (editable), Descripción (editable), Insumos table (same shape as mantenimiento insumos but no sugerida — just `cantidad`), Observaciones.
  - Right: Solicitante, Responsable, Localidad, Unidad productiva, Prioridad, Estado chip + transition buttons.
- On "Cerrar": confirm dialog showing insumos that will be consumed + warn on over-consumption per line.

### 5.9 `/ordenes-trabajo/nueva` — create (Slice D)

- Form: Título (required), Descripción, Localidad (optional), Unidad productiva (optional), Solicitante (default current user), Responsable (UsuarioCombobox), Prioridad hidden advanced.
- Submit → create OT with estado=En Curso, redirect to detail.

## 6. Components

### 6.1 `<MaquinariaCombobox />` (new — `components/mantenimiento/`)

Searchable async combobox over all Maquinaria, loading on open (236 options is fine without virtualization — test with real data during QA). Options display tipo + nroSerie + principal-atributo. Optionally filter by tipoId prop (for plantilla aplicar flow). Reuses shadcn Command/Popover like existing `Combobox` but wrapped for this specific shape.

### 6.2 `<InsumosEditor />` (new — `components/mantenimiento/`)

Table-style editor for mantenimiento/OT insumos. Columns: Item (InventarioCombobox — already exists for compras/requisiciones), Cantidad sugerida (read-only if plantilla-spawned), Cantidad utilizada (editable, 2 decimals), Costo unitario (read-only, from `Inventario.valorUnitario`), Costo total (computed). "Agregar línea" below. "Eliminar línea" per row (disabled if plantilla-spawned + has cantidadUtilizada > 0 to preserve audit).

### 6.3 `<HistorialTimeline />` (new — `components/mantenimiento/`)

Reverse-chronological list of `MantenimientoHistorial` rows. Icons per tipo_cambio (lucide: `Activity` for estado, `Box` for insumo, `Building2` for taller, `User` for responsable, `MessageSquare` for observacion). Format: "{usuario} · {fecha} — {rendered change}". Compact on mobile.

### 6.4 `<EstadoChip />` (reuse from `components/compras/`)

Already exists — accepts `estado` string and applies tone classes via a lookup. Extend the lookup to cover mantenimiento and OT estados. Tones: Pendiente = muted, En Reparación — * = sky, Finalizado = emerald, Cancelado = destructive, Cerrada = emerald, En Curso = sky.

### 6.5 `<PrioridadBadge />` — NOT building

Priority is dead weight per §2.2. Render as plain text on detail pages; no badge component.

## 7. Data model

### 7.1 Schema additions — none

Every field needed by this spec already exists in Phase 1 schema. No migration in Phase 6. If implementation surfaces a gap (e.g., we decide to add OT ↔ Mantenimiento link), add it in a follow-up — don't bundle speculative columns now.

### 7.2 Observed schema quirks worth noting

- `Mantenimiento.esRecurrente Boolean @default(true)` — spec hides from UI; keep default.
- `Mantenimiento.responsableId Int` — **not nullable**. Create form must require it.
- `PlantillaInsumo.unidadMedida String` — not nullable. Pull from `Inventario.unidadMedida` on combobox select; require user to confirm if inventario row has no unidadMedida.
- `OrdenTrabajo.solicitanteId Int?` — nullable. Default to current user session but allow null.

## 8. Edge cases

1. **Máquina deleted while mantenimiento is open.** `Maquinaria.mantenimientos` has no cascade in schema. Maquinaria delete is already blocked if any mantenimiento exists (per Phase 4 spec). Keep that constraint.
2. **Over-consumption on finalizar.** Allowed with warning. Show a toast with the affected lines and require confirmation click; don't block the save.
3. **Concurrent finalización.** Two users click Finalizar at once. Mitigate with `where: { estado: { in: ["Pendiente", "En Reparación — Chacra", "En Reparación — Taller"] } }` on the update — if it hits 0 rows, the other user got there first; show "Este mantenimiento ya no está abierto" toast.
4. **Plantilla deleted while mantenimiento references it.** `Mantenimiento.plantillaId` is nullable without cascade. Deleting a plantilla in use is blocked per §5.4.
5. **Horómetro lower than previous reading.** Block on submit. Error: "El horómetro nuevo ({nuevo}) debe ser mayor al anterior ({anterior})."
6. **Mantenimiento with zero insumos.** Common — not all reparaciones consume stock. Finalizar proceeds with no InventarioMovimiento emission. Historial still writes the estado transition.
7. **OT cerrada with zero insumos.** Same as above.
8. **Revisión programada on a máquina that's since been archived / inactive.** The child mantenimiento is still created — user can cancel it manually. Don't silently skip.

## 9. i18n

New namespace `mantenimiento.*`:

- `mantenimiento.index.titulo`, `descripcion`, `nuevo`, `volver`
- `mantenimiento.subnav.{mantenimientos, plantillas, horometros}`
- `mantenimiento.estados.{Pendiente, EnReparacionChacra, EnReparacionTaller, Finalizado, Cancelado}`
- `mantenimiento.tipos.{correctivo, preventivo}`
- `mantenimiento.campos.{maquina, tipo, descripcion, responsable, unidadProductiva, taller, fechaCreacion, fechaInicio, fechaFinalizacion, fechaProgramada, prioridad, observaciones}`
- `mantenimiento.columnas.{numero, diasAbiertos}`
- `mantenimiento.filtros.{estado, tipo, maquina, responsable, todos, incluirCerrados}`
- `mantenimiento.acciones.{iniciarChacra, iniciarTaller, cambiarTaller, finalizar, cancelar, programarRevision}`
- `mantenimiento.historial.{titulo, tipoEstado, tipoInsumo, tipoTaller, tipoResponsable, tipoObservacion, sinEventos}`
- `mantenimiento.insumos.{titulo, agregar, item, cantidadSugerida, cantidadUtilizada, costoUnitario, costoTotal, sinInsumos, sobreConsumoAviso}`
- `mantenimiento.tareas.{titulo, agregar, realizada, sinTareas}`
- `mantenimiento.avisos.{creadoExitoso, actualizadoExitoso, estadoCambiadoExitoso, yaCerrado, horasMenoresAnterior, insumosSobreConsumo}`
- `mantenimiento.plantillas.{titulo, descripcion, nueva, nueva.titulo, editar, aplicar, nombre, tipoMaquinaria, frecuenciaValor, frecuenciaUnidad, frecuencias.{Horas, Dias, Meses}, insumosCount, tareasCount, avisos.{enUso, creadaExitoso, aplicadaExitoso}}`
- `mantenimiento.horometros.{titulo, descripcion, nuevo, horasAnterior, horasNuevo, diferencia, avisos.{registradoExitoso, horasInvalidas}}`

New namespace `ordenesTrabajo.*`:

- `ordenesTrabajo.index.{titulo, descripcion, nueva, volver}`
- `ordenesTrabajo.estados.{EnCurso, Cerrada, Cancelada}`
- `ordenesTrabajo.campos.{numero, titulo, descripcion, solicitante, responsable, localidad, unidadProductiva, prioridad, fechaCreacion, fechaFinalizacion, observaciones}`
- `ordenesTrabajo.acciones.{cerrar, cancelar}`
- `ordenesTrabajo.avisos.{creadaExitoso, cerradaExitoso, canceladaExitoso, insumosSobreConsumo}`

## 10. Out of scope for v1

- **Cron-triggered plantilla application.** Manual admin button only. Revisit once there are ≥5 active plantillas in production.
- **OT ↔ Mantenimiento link.** Not in schema. Not justified by volume.
- **Tarea completion gating state transitions.** Tareas are informational only.
- **Priority pickers.** Always defaults to Media; hidden behind "Opciones avanzadas".
- **Mantenimiento reopen.** Terminal states are terminal. If a reparación needs more work, create a child mantenimiento.
- **Insumo reservation before finalización.** Stock decrement happens at finalizar, not at add-to-insumos-list. Means stock can technically be double-counted across parallel open mantenimientos — accept the race for v1, surface in a Phase 7 dashboard later if it matters.
- **Multi-máquina OT.** OT is per-OT, not per-máquina. If a job touches two machines, two OTs.
- **MantenimientoHistorial export / PDF.** Timeline is viewable on screen only.
- **Mobile-optimized insumos editor.** Same table layout on mobile — acceptable for v1 because Cervi edits insumos from the taller (desktop), not the field.

## 11. Phase 6 risks

1. **MaquinariaCombobox performance.** 236 options without virtualization. Test on a slow tablet — if it lags, add `cmdk` virtualization.
2. **Over-consumption warn-don't-block policy.** Easy to create phantom stock. Mitigation: stock < 0 warning badge on Inventario list (existing); Phase 7 dashboard showing items with negative stock.
3. **Historial noise.** Every estado change writes a row; every insumo edit at finalización writes another. 6 events/mantenimiento is the current average — expect 10+ with the new granularity. Timeline needs a "show older" fold after 20 rows.
4. **Concurrent estado transitions.** Two users click Finalizar. `where: estado IN (...)` on the update handles it; test with two browser tabs during QA.
5. **Plantilla "aplicar" spawns mantenimiento with wrong máquina tipo.** Combobox filtered by `plantilla.tipoMaquinariaId` prevents. Also server-side validation.

---

## Slice plan

| Slice | Scope | Estimate |
|---|---|---|
| A | Mantenimiento list + detail + create + estado transitions + insumos + tareas + historial | 1–1.5 weeks |
| B | Plantillas CRUD + aplicar a máquina | 3 days |
| C | Registro de horas list + create | 1 day |
| D | OT list + detail + create + cerrar (insumos → salida movements) | 2–3 days |

Each slice mergeable on its own. Slice A blocks B (plantilla aplicar writes to Mantenimiento). C is independent. D is independent.
