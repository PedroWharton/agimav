# UX Spec 4 — Compras

Scope: the procure-to-pay pipeline — requisiciones, approval, supplier assignment, OC generation (with PDF), recepciones, facturación, and price-history / weighted-avg cost update. Five mergeable slices. This is the largest module in the app; the state machine is the hard part, not the forms.

**Not in this spec:** dashboards of purchase activity (Phase 7), multi-currency invoices (price history stores ARS only for v1; USD timeline lives on `dolar_cotizaciones` joins in Phase 7), supplier self-service portal, reopening closed OCs, OC line editing after emission.

## 1. Purpose & user

Give Cervi a single place to:

- open a requisición when a user needs something (repuesto, consumible, servicio), route it to an approver, and track it through receipt and invoicing;
- let procurement split a multi-line requisición across multiple suppliers, generate one OC per supplier **without losing the supplier assignment** if the clerk navigates away mid-task (the main legacy bug we're here to fix);
- produce a printable/emailable OC PDF that matches the ReportLab layout Cervi already sends to suppliers;
- reconcile supplier invoices against what was received, lock invoiced lines so nothing can be re-billed, and feed price history + weighted-average item cost from the invoice line.

- **Primary actors**
  - `Solicitante` (`Mecánico`, `Encargado`, `Pañolero`) — opens a requisición, adds detail lines, submits for review.
  - `Aprobador` (`Administrador` — role-gated in v1) — approves or rejects. In later phases we may introduce a dedicated `Jefe de Compras` role.
  - `Comprador` (`Administrador` in v1) — assigns suppliers per line, generates OCs, sends PDF.
  - `Pañolero` — registers recepción against an open OC.
  - `Contable` (`Administrador` in v1) — registers factura, triggers cost update.
- **Primary job-to-be-done:** *"I need an oil filter for T-25. Can I get one by Friday, and where does that show up in the books?"* — the answer needs a single traceable chain from requisición to factura, and the factura needs to update the item's average cost so Mantenimiento/OT reports stay honest.
- **Why it matters:** Inventario, Mantenimiento, OT, and Estadísticas all read prices and costs written here. Without Compras, the app is a read-only catalog. Also, Cervi's legacy Tkinter app has the supplier-assignment bug (see §2.3) — that's *the* pain point they've been waiting for.

## 2. Reality check — what the data actually looks like today

Probe on `flota7.db` (2026-04-19, ad-hoc SQL — no probe script committed since this spec will trigger the first real writes).

### 2.1 Volumes

| Table | Rows | Avg lines per doc |
|---|---:|---:|
| `requisiciones` | 134 | — |
| `requisiciones_detalle` | 300 | 2.24 / req |
| `ordenes_compra` | 114 | — |
| `ordenes_compra_detalle` | 299 | 2.62 / OC |
| `recepciones` | 92 | — |
| `recepciones_detalle` | 206 | 2.24 / recep |
| `facturas` | 39 | — |
| `factura_detalle` | 85 | 2.18 / factura |
| `precios_historico` | 116 (85 `factura`, 31 `OC`) | — |
| `proveedores` | 57 | — |

Small volumes. No table needs pagination virtualization for this module — TanStack with server-side pagination at 50/page is plenty.

### 2.2 State distributions (legacy)

- **Requisiciones by estado:** `Aprobada` 134 / all others 0. Legacy never persisted `Borrador` or `En Revisión` — those states lived inside a Tkinter modal. Slices A/B create *net-new* persisted states; migration leaves legacy rows as `Aprobada`.
- **Requisicion-detalle by estado:** `Vinculada OC` 299 / `Pendiente` 1. Once a req was approved it turned into an OC essentially atomically.
- **OC by estado:** `Completada` 90 / `Cancelada` 20 / `Emitida` 4. No `Parcialmente Recibida` rows — legacy didn't support partial reception.
- **Recepción coverage per OC line:** 205 received-exact / 94 received-none / **0 partial**. Legacy was "receive in full or not at all."
- **Recepciones per OC:** 88/90 OCs with recepción have exactly 1. Only 2 have 2. Multi-recepción is real but rare.
- **Requisiciones with split suppliers:** 115/133 go to 1 OC, 13 to 2, 4 to 3, 1 to 4. ~14% of reqs are multi-supplier. Enough to make "Slice C supplier assignment" matter, but not the common path — design for single-supplier speed.

### 2.3 Legacy bugs and gaps Phase 5 fixes

1. **Supplier assignment is ephemeral.** In Tkinter, `generar_ocs` (`Agimav23b.py:16405`) holds a per-line supplier dict inside the modal only. If the clerk navigates away, the picks vanish. Fix: persist supplier assignment to `RequisicionDetalle.proveedorAsignadoId`, route reqs through a new `Asignado a Proveedor` state before OC generation.
2. **OC prices are almost never populated.** `ordenes_compra.total_estimado = 0` across the sample (114/114). OC-line `precio_unitario` is filled only when the comprador happened to enter it. Our UI allows — but does not require — prices at OC creation; the canonical price capture point remains the factura.
3. **Approval audit is thin.** `aprobado_por` populated for 34/134 (25%); `fecha_aprobacion` 0/134; `numero_orden_interna` 0/134. Legacy columns exist but weren't used. Phase 5 populates them going forward; migrated rows stay null.
4. **No partial-receipt semantics.** Net-new in our app, not a legacy feature. Build for it but don't over-engineer edge cases that won't come up in the first year of use.
5. **OC cancellation is already a first-class path** (20/114 OCs). Not an afterthought — wire the cancel action into every OC-stage screen.
6. **Denormalized text on requisiciones.** `solicitante`, `unidad_productiva`, `localidad` are plain `String` (schema parity, not FK). 27 distinct UPs, 7 distinct localidades. Form uses autocomplete from `listados` tables but writes the label as text — matches Inventario's decision.

### 2.4 Facturas carry full discount/IVA structure

The schema (from Phase 1) exposes legacy's multi-discount + IVA math:

- `Factura.subtotal`, `descuentoComercial`, `descuentoFinanciero`, `recargo`, `netoGravado`, `ivaPorcentaje` (default 21), `ivaMonto`, `total`.
- `FacturaDetalle.descuentoComercialPorcentaje` — per-line comercial discount.

Don't simplify this to "one discount column." Cervi's accountants match invoices line-by-line with per-line discount %, then header-level descuento financiero + recargo + IVA.

### 2.5 Implications for the spec

1. **Legacy requisición rows land directly in `Aprobada`.** All pre-Phase-5 writes stay Aprobada; the Borrador → En Revisión workflow kicks in only for rows created after cutover.
2. **`RequisicionDetalle.proveedorAsignadoId` is net-new** (nullable FK → `Proveedor`). Legacy rows with `estado='Vinculada OC'` already have their OC; backfill sets `proveedorAsignadoId = that OC's proveedorId` so the audit trail isn't empty. One-shot SQL in the migration PR; not a feature flow.
3. **OC `totalEstimado` defaults to 0 and is user-editable, not auto-computed**, to match legacy. We optionally auto-sum line totals when *any* line has a price, but default display is "—" when all lines are zero-priced.
4. **Partial receipt is supported end-to-end** but the default "Recibir todo" button fills cantidades to match OC pending qty in one click (the only flow 95% of users will take).
5. **Price-discrepancy badge fires only when both sides are non-zero.** When OC price was 0, the factura line sets the price with no warning — that's expected.

## 3. Scope & shipping plan

Five mergeable slices. Each ships behind its own PR, each with its own acceptance checklist. Budget one week per slice; Slice C has PDF fidelity risk and may slip a day.

### Slice A — Requisiciones (PR #1)

- `/compras/requisiciones` list (TanStack table, filter by estado + solicitante + UP + fecha range + texto en notas).
- `/compras/requisiciones/nueva` + `/compras/requisiciones/[id]`.
- Create/edit Sheet (Borrador only): solicitante (usuario picker), unidad_productiva (autocomplete from `unidades_productivas`, writes text), localidad (autocomplete from `localidades`, writes text), prioridad (`Normal`/`Urgente`), fecha_tentativa, fecha_limite, notas.
- Detail lines editor (`DetalleLinesEditor`, new component): add/edit/delete rows; columns = inventario item (Combobox reusing maquinaria `RefCombobox`), cantidad, unidad (read-only from inventario), prioridad_item, notas_item. Blank line at bottom always.
- State transitions (Slice A): `Borrador` → `En Revisión` (submit). Edit and delete blocked once the req leaves `Borrador`.
- **Writes:** `Requisicion`, `RequisicionDetalle`.
- **Not in Slice A:** approval, supplier assignment, OC, recepción, factura.

### Slice B — Aprobaciones (PR #2)

- Approve/reject actions on `/compras/requisiciones/[id]` for rows in `En Revisión`. Role gate: `Administrador` only in v1 (`Jefe de Compras` role parked for later).
- Actions write `fechaAprobacion`/`aprobadoPor` or `fechaCancelacion`/`canceladoPor` and flip `estado` to `Aprobada` or `Rechazada`.
- Audit footer on req detail shows: creado por / fecha, aprobado por / fecha, cancelado por / fecha — each row rendered only when populated, since legacy rows usually aren't.
- Rejected: show rejection note (required), transitions to `Rechazada` (terminal). `Rechazada` reqs are read-only and do not appear by default in the list filter.
- **In-app toast + unread badge** on the solicitante's session (matching Listados invite-link flow — no email in v1).
- **Writes:** `Requisicion` (audit columns + estado).

### Slice C — OC generation (PR #3) — *load-bearing*

**Fixes the legacy supplier-assignment bug** (§2.3.1).

- `/compras/requisiciones/[id]/asignar` — appears for reqs in `Aprobada` with at least one line not yet assigned.
  - Line-by-line table: inventario + cantidad + **proveedor** picker (Combobox querying `proveedores` where `estado='activo'`).
  - Save-and-close and save-and-continue buttons. Assignment persists to `RequisicionDetalle.proveedorAsignadoId` on every save; the clerk can walk away and resume.
  - Once all lines are assigned, the req transitions to `Asignado a Proveedor` (new estado). A "Generar OCs" button becomes active.
  - Power-user shortcut: "Asignar todo a un proveedor" bulk select (single-supplier case, which is 86% of reqs per §2.2).
- **Generate OCs action** — runs inside `prisma.$transaction` (interactive callback, not batched array; we need early-abort):
  1. Re-load req with lines. If any line has no `proveedorAsignadoId`, abort with a 409.
  2. Group lines by proveedorId.
  3. For each group, create one `OrdenCompra` + its `OrdenCompraDetalle` rows. `numero_oc` = next `OC-NNNNNN` (see §7.4).
  4. Flip `RequisicionDetalle.estado` from `Pendiente` to `Vinculada OC` for every line processed.
  5. Flip `Requisicion.estado` to `OC Emitida` (new terminal estado on the req side — legacy implicitly went to `Aprobada` forever).
  6. For each OC line that has a non-zero `precioUnitario`, write a row to `PrecioHistorico` with `fuente='OC'`, `numeroDocumento=numero_oc`.
- **OC detail screen** `/compras/oc/[id]` — header (proveedor, fecha, estado, comprador, observaciones, cancelar button), line table (item / cantidad / precio unit / total), `descargar PDF` button.
- **OC PDF** (`@react-pdf/renderer`, first use in this codebase):
  - Layout mirrors `crear_pdf_oc_profesional` (`Agimav23b.py:16813`): header with company block left (logo + CUIT + dirección from a `.env`-configured block, not DB) and supplier block right (`nombre`, `cuit`, `condicion_iva`, `direccion_fiscal`), body with itemized table (código, descripción, cantidad, precio unit, descuento %, subtotal), footer with totals (subtotal / descuento / neto / IVA / total). No supplier-self-service elements.
  - Generated on demand (route handler `/compras/oc/[id]/pdf`); not persisted as a blob. Cache via HTTP headers if it ever shows up in profiling (not premature).
  - Budget one full day for pixel-matching.
- **OC cancellation** — admin action on `Emitida` OCs with no recepciones. Writes `fechaCancelacion`, `canceladoPor`, `estado='Cancelada'`; sets the upstream `RequisicionDetalle` lines back to `Pendiente` so they can be reassigned. Blocked if any recepción exists (cancel individual recepciones first — out of scope v1; the workaround is a manual reversal factura).
- **Writes:** `RequisicionDetalle` (proveedorAsignadoId + estado), `Requisicion` (estado), `OrdenCompra`, `OrdenCompraDetalle`, `PrecioHistorico` (OC-sourced rows).

### Slice D — Recepciones (PR #4)

- `/compras/recepciones` list + `/compras/recepciones/nueva?ocId=…` + `/compras/recepciones/[id]`.
- Create recepción against one `Emitida` or `Parcialmente Recibida` OC. UI shows each OC line with `pendiente = cantidadSolicitada - cantidadRecibidaAcumulada`, input `cantidadRecibidaAhora` (≤ pendiente, ≥ 0), observaciones, and per-line `destino: Stock | Directa` (**new field**, see §4.2).
  - `Recibir todo` button fills every row's qty to match its pendiente (default flow per §2.5).
- Required header fields: `numeroRemito`, `fechaRecepcion` (default today), `recibidoPor` (default current user), observaciones.
- On save (inside `prisma.$transaction`):
  1. Insert `Recepcion` + `RecepcionDetalle` rows for any line with qty > 0.
  2. Update each `OrdenCompraDetalle.cantidadRecibida += cantidadRecibidaAhora`.
  3. Compute OC new estado: if every line is received-in-full → `Completada`, if some pendiente remains and some received → `Parcialmente Recibida`, else no change.
  4. For each line with `destino = Stock`: insert `InventarioMovimiento` (tipo `entrada`, módulo `compras`, `itemId`, `cantidad`, `costo_unitario = OCDetalle.precioUnitario`, `costo_total`, `numero_documento = numero_remito`). **If OC price was 0**, costo_unitario = 0 and costo_total = 0; the actual cost gets corrected at factura time (§Slice E).
  5. For lines with `destino = Directa`: skip the inventory movement (the item went straight to the user / máquina, never touched pañol).
- Edge cases:
  - Over-reception blocked in the form (qty > pendiente → field error).
  - Mid-line destino mix (line 1 Stock, line 2 Directa) is fine.
  - Partial → partial → complete flow verified in manual QA.
- Recepción cancellation is **out of scope v1**. If a recepción was entered wrong, the workaround is a manual `ajuste` movement in Inventario. Parking post-cutover.
- **Writes:** `Recepcion`, `RecepcionDetalle`, `OrdenCompra` (estado + line cumulative qty), `InventarioMovimiento` (when Stock).
- Reference: `procesar_recepcion` (`Agimav23b.py:17526`).

### Slice E — Facturación + precio / costo promedio (PR #5)

- `/compras/facturas` list + `/compras/facturas/nueva?proveedorId=…` + `/compras/facturas/[id]`.
- Create flow:
  1. Select proveedor.
  2. Table of *unfacturadas* recepción detalle rows for that proveedor: `RecepcionDetalle` where `facturado=false` and `ocDetalle.oc.proveedorId = selected`.
  3. Clerk picks lines (multi-select), enters per-line `precioUnitario` and `descuentoComercialPorcentaje`. Header inputs: `numeroFactura` (unique), `fechaFactura`, `subtotal`/`descuentoComercial`/`descuentoFinanciero`/`recargo`/`netoGravado`/`ivaPorcentaje` (default 21) / `ivaMonto` / `total`. Live-computed helpers show what each field *should* be; user can override (legacy parity — accountants sometimes round manually).
  4. Per-line price discrepancy badge vs OC price (§7.5) — warn only when both sides non-zero (§2.5).
- On save (inside `prisma.$transaction`):
  1. Insert `Factura` + `FacturaDetalle`.
  2. Set `RecepcionDetalle.facturado = true` on every picked line — **strictly; no re-invoicing**.
  3. Insert `PrecioHistorico` row per line with `fuente='factura'`, `precioArs = precio_neto_post_descuento`, `numeroDocumento=numeroFactura`.
  4. **Weighted-average cost update** per `itemId`: `newCost = (oldValorUnitario * oldStock + facturaCost * facturaQty) / (oldStock + facturaQty)` — computed against stock *before* the factura for stock neutrality (the stock itself was already moved at recepción time). Write `Inventario.valorUnitario = newCost`, recompute `valorTotal = stock * valorUnitario`. Skip the update when `oldStock + facturaQty ≤ 0` (avoid div-by-zero on over-drawn legacy items).
- Factura cancellation: **out of scope v1**. Same workaround as recepciones — manual `ajuste` en Inventario + accountant cleans up in their own system.
- **Writes:** `Factura`, `FacturaDetalle`, `RecepcionDetalle.facturado`, `PrecioHistorico`, `Inventario.valorUnitario` + `.valorTotal`.
- Reference: `procesar_factura` (`Agimav23b.py:19644`).

## 4. Schema touches (pre-build)

Existing Phase 1 schema covers 95% of what we need. Additive-only changes:

1. **`RequisicionDetalle.proveedorAsignadoId Int?`** — nullable FK to `Proveedor`. New column, no backfill required for forward flows. One-shot SQL in the migration PR populates legacy `Vinculada OC` rows from their OC's proveedorId so audit trail isn't empty (see §2.5.2).
2. **`InventarioMovimiento.destino String?`** — new nullable column `"Stock" | "Directa"`. Only set when the movimiento originated from a recepción; legacy rows stay null. (Schema currently lacks this field — confirm against `prisma/schema.prisma` before the Slice D PR; if present under a different name, reuse.)
3. **`Requisicion` estado expanded vocabulary**: `Borrador` | `En Revisión` | `Aprobada` | `Asignado a Proveedor` | `OC Emitida` | `Rechazada`. No schema change — `estado` is a `String`. Just documented here and enforced in zod.
4. **`OrdenCompra` estado vocabulary**: `Emitida` | `Parcialmente Recibida` | `Completada` | `Cancelada`. `Parcialmente Recibida` is new (zero legacy rows); migration safe.
5. **Audit columns on `Proveedor`** — add `createdAt`/`updatedAt`/`createdById` if missing, matching the pattern applied to `Maquinaria` / `MaquinariaTipo` in Phase 4. Confirm before the Slice A PR; skip if already present.
6. **Indexes to add** (only if `EXPLAIN` shows > 100ms on seed data):
   - `requisiciones_detalle (proveedor_asignado_id)` for the OC-generation grouping query.
   - `recepciones_detalle (facturado)` partial on `false` for the factura line-picker query.
   Defer both until we see actual seed perf; Phase 5 volumes are small.
7. **No schema changes to** `Factura` / `FacturaDetalle` / `PrecioHistorico` / `Recepcion` / `RecepcionDetalle` / `OrdenCompra` / `OrdenCompraDetalle`. Current shape handles the flow.

## 5. Screens

Seven surfaces. Wireframes show density; polish follows foundation tokens (`sky-*`, no raw hex).

### 5.1 Requisiciones list — `/compras/requisiciones`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Requisiciones                                      [+ Nueva requisición]  │
│ ───────────────────────────────────────────────────────────────────────── │
│ [Buscar por solicitante o notas… 🔎]  [Estado ▾]  [UP ▾]  [Fecha ▾]       │
│                                                                   134 reqs│
│ ───────────────────────────────────────────────────────────────────────── │
│ # │ Fecha      │ Solicitante │ UP           │ Líneas │ Estado       │ ⋯   │
│ ───────────────────────────────────────────────────────────────────────── │
│ 134│ 19/04/2026 │ Diego       │ Martín Fierro│ 3     │ En Revisión  │ ⋯   │
│ 133│ 18/04/2026 │ Arnoldo     │ Frigorífico  │ 1     │ Borrador     │ ⋯   │
│ 132│ 17/04/2026 │ Pedro       │ Taller Chacra│ 5     │ OC Emitida   │ ⋯   │
│ ...                                                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

- Estado chip uses brand tokens: `Borrador` muted, `En Revisión` amber, `Aprobada`/`Asignado a Proveedor`/`OC Emitida` sky, `Rechazada` destructive.
- Default filter excludes `Rechazada`; toggle in filter menu to include.
- Row click → detail page (not drawer — too much to fit).

### 5.2 Requisición detail — `/compras/requisiciones/[id]`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Requisiciones                                       [Editar] [Enviar]   │
│ Req #134  ·  Borrador  ·  19/04/2026                                      │
│ Solicitante: Diego    UP: Martín Fierro    Localidad: Las Perlas          │
│ Prioridad: Normal     F. tentativa: —     F. límite: 30/04/2026           │
│ Notas: Reposición pañol mensual                                           │
│ ───────────────────────────────────────────────────────────────────────── │
│ Líneas                                                      [+ Línea]     │
│ # │ Código │ Descripción           │ Cant. │ Unid │ Prior.  │ Estado  │ ⋯ │
│ ───────────────────────────────────────────────────────────────────────── │
│ 1 │ A32    │ CORREA                │ 2,0   │ u    │ Normal  │ Pend.   │ ⋯ │
│ 2 │ 6PK1515│ Correa de alternador  │ 1,0   │ u    │ Normal  │ Pend.   │ ⋯ │
│ ───────────────────────────────────────────────────────────────────────── │
│ Auditoría                                                                 │
│   Creada por Diego · 19/04/2026 09:14                                     │
│   (aprobación pendiente)                                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

- Top-right actions depend on estado + role:
  - `Borrador` + owner → `[Editar]` `[Eliminar]` `[Enviar a revisión]`.
  - `En Revisión` + aprobador → `[Aprobar]` `[Rechazar]`.
  - `Aprobada` + comprador → `[Asignar proveedores]`.
  - `Asignado a Proveedor` + comprador → `[Generar OCs]` `[Revisar asignación]`.
  - `OC Emitida` → read-only, links to each OC in the auditoría block.
  - `Rechazada` → read-only with rejection note.
- "Enviar a revisión" requires at least one line.
- "Aprobar" prompts for optional comment; "Rechazar" prompts for required note.

### 5.3 Asignar proveedores — `/compras/requisiciones/[id]/asignar`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Req #134                                  [Guardar borrador] [Generar]  │
│ Asignar proveedores                                                       │
│ Asignados: 2/3         [Asignar todos a un proveedor ▾]                   │
│ ───────────────────────────────────────────────────────────────────────── │
│ # │ Código │ Descripción           │ Cant. │ Proveedor                │ ⋯ │
│ ───────────────────────────────────────────────────────────────────────── │
│ 1 │ A32    │ CORREA                │ 2,0   │ PAÑOL                    ✓  │
│ 2 │ 6PK1515│ Correa de alternador  │ 1,0   │ Repuestos Industriales   ✓  │
│ 3 │ AL-12  │ Filtro aire           │ 1,0   │ [Seleccionar…        ▾]     │
│ ───────────────────────────────────────────────────────────────────────── │
│ Generar OCs crea 2 órdenes (PAÑOL, Repuestos Industriales).               │
│ La línea 3 no tiene proveedor — asignala o quitala antes de generar.      │
└───────────────────────────────────────────────────────────────────────────┘
```

- Proveedor Combobox queries `proveedores` where `estado='activo'`, ordered by name. Debounced search.
- "Guardar borrador" persists each line's `proveedorAsignadoId` without changing estado. `[Generar OCs]` only enables when all lines are assigned.
- The bulk "Asignar todos a un proveedor" short-circuits the common case.
- On "Generar" click: confirm dialog summarising "N OCs will be created for: [supplier 1 (X lines), supplier 2 (Y lines), …]". Then transaction; on success, redirect to the req detail which now shows each new OC linked in the audit block.

### 5.4 OC detail — `/compras/oc/[id]`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← OCs                                    [Descargar PDF] [Cancelar OC]    │
│ OC-000114  ·  Emitida  ·  19/04/2026                                      │
│ Proveedor: Repuestos Industriales · CUIT 30-XXXXXXXX-X                    │
│ Comprador: Diego                                                          │
│ Observaciones: Retirar en depósito El Bolsón.                             │
│ ───────────────────────────────────────────────────────────────────────── │
│ # │ Código  │ Descripción          │ Cant. │ Precio │ Subtotal │ Recibido │
│ ───────────────────────────────────────────────────────────────────────── │
│ 1 │ 6PK1515 │ Correa de alternador │ 1,00  │ —      │ —        │ 0,00     │
│ 2 │ AL-12   │ Filtro aire          │ 1,00  │ 12.500 │ 12.500   │ 0,00     │
│ ───────────────────────────────────────────────────────────────────────── │
│ Totales: subtotal 12.500 · IVA (pendiente en factura) · total estimado    │
│ Req origen: #134 — Diego, Martín Fierro                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

- Dashes where `precioUnitario = 0` (matches legacy default, §2.3.2).
- `[Cancelar OC]` disabled when any recepción exists (tooltip explains).
- `[Descargar PDF]` opens the generated PDF in a new tab. If `@react-pdf/renderer` throws at runtime, fall back to a server-side error page (don't crash the app shell).

### 5.5 Recepción create — `/compras/recepciones/nueva?ocId=…`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← OC-000114                                         [Recibir todo] [Guard.]│
│ Nueva recepción · OC-000114 · Repuestos Industriales                      │
│ Remito Nº *  [________]    Fecha [19/04/2026]    Recibido por [Diego ▾]   │
│ Observaciones [____________________________________]                      │
│ ───────────────────────────────────────────────────────────────────────── │
│ # │ Descripción          │ Pend. │ Recibir ahora │ Destino        │ Obs.  │
│ ───────────────────────────────────────────────────────────────────────── │
│ 1 │ Correa de alternador │ 1,00  │ [ 1,00 ]      │ ● Stock ○ Dir. │ [   ] │
│ 2 │ Filtro aire          │ 1,00  │ [ 1,00 ]      │ ● Stock ○ Dir. │ [   ] │
│ ───────────────────────────────────────────────────────────────────────── │
│ Saldo tras recepción: OC completa. 2 movimientos entrada a pañol.         │
└───────────────────────────────────────────────────────────────────────────┘
```

- "Recibir todo" fills the qty column with each line's pendiente.
- Live-computed footer tells the user what the save will do ("OC completa", "OC parcialmente recibida — quedan N líneas pendientes", "N entradas a stock, M directas").
- Qty input enforces `0 ≤ v ≤ pendiente`; blur-format to 2 decimal places.

### 5.6 Factura create — `/compras/facturas/nueva?proveedorId=…`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Facturas                                                      [Guardar] │
│ Nueva factura · Repuestos Industriales                                    │
│ Nº Factura * [B-0001-00000042]   Fecha * [19/04/2026]                     │
│ ───────────────────────────────────────────────────────────────────────── │
│ Líneas unfacturadas del proveedor       [Seleccionar todas]               │
│ ☑ │ Remito   │ Descripción          │ Cant. │ Precio unit. │ Desc.% │ !    │
│ ───────────────────────────────────────────────────────────────────────── │
│ ☑ │ R-00123  │ Correa de alternador │ 1,00  │ [ 15.200 ]   │ [ 0 ]  │ 🟡  │
│ ☑ │ R-00123  │ Filtro aire          │ 1,00  │ [ 12.500 ]   │ [ 0 ]  │ ✓   │
│ ───────────────────────────────────────────────────────────────────────── │
│ Subtotal          27.700                                                  │
│ Desc. comercial   [ 0 ]                                                   │
│ Desc. financiero  [ 0 ]                                                   │
│ Recargo           [ 0 ]                                                   │
│ Neto gravado      27.700                                                  │
│ IVA  [21,00]%     5.817                                                   │
│ TOTAL             33.517                                                  │
│ ───────────────────────────────────────────────────────────────────────── │
│ 🟡 L1 — Precio factura (15.200) distinto al OC (—). No hay advertencia.   │
│   (la OC no tenía precio cargado; se tomará el de factura.)               │
└───────────────────────────────────────────────────────────────────────────┘
```

- Price-discrepancy badge per line:
  - ✓ exact match with OC price.
  - 🟡 OC price set, difference > 0.5% — warning, save allowed.
  - 🔴 OC price set, difference > 10% — confirm dialog required on save.
  - (gris) OC price was 0 → no badge, no warning.
- Totals are live-computed but every field overridable (legacy parity). If the user's computed total differs from the sum of line totals after discounts, show a footer warning but allow save.
- On save: the full transaction runs, `facturado=true` is locked on every selected line, cost update fires.

### 5.7 Facturas list — `/compras/facturas`

Standard TanStack list: numero_factura, proveedor, fecha_factura, total, fecha_registro. Filter by proveedor + fecha range + numero_factura search. Row click → read-only detail (same layout as create, all fields disabled).

## 6. Components

Reused from prior phases:

- `ModuleHeader`, `AppSheet`, `ConfirmDialog`, `DataTable` (TanStack), `RefCombobox`, `TableColumnsMenu` — all exist.
- `InventarioCombobox` (from Phase 3) — reuse for requisición line item picker.

New in Phase 5:

- `DetalleLinesEditor` — reusable multi-row editor used by requisiciones, recepciones, facturas. Props: column schema, row factory, zod validator per row. The only non-trivial piece is keyboard nav (Tab from last cell inserts a new blank row).
- `ProveedorCombobox` — thin wrapper over `RefCombobox` wired to `proveedores` search. Hoist if a second consumer appears.
- `OCPdf` — `@react-pdf/renderer` component. Props: OC payload (header + lines + company block + totals). Self-contained; no client-side React tree needed.
- `PriceDiscrepancyBadge` — pure component. Props: `ocPrice`, `facturaPrice`. Returns a span with the right color + tooltip.
- `EstadoChip` — one component, centralised color map for every estado across requisición/OC/recepción/factura.

No drag-and-drop, no virtualization. Volumes in §2.1 don't need it.

## 7. Data model touch (read paths + business rules)

### 7.1 Requisiciones list

```ts
prisma.requisicion.findMany({
  where: { /* filters + estado not in ['Rechazada'] unless toggled */ },
  include: { _count: { select: { detalle: true } } },
  orderBy: { id: 'desc' },
  take: 50,
  skip: page * 50,
})
```

### 7.2 Requisición detail

```ts
prisma.requisicion.findUnique({
  where: { id },
  include: {
    detalle: {
      include: {
        item: true,
        ocDetalle: { include: { oc: true } }, // to surface "linked OCs" block
      },
    },
  },
})
```

### 7.3 Unfacturadas for a proveedor

```ts
prisma.recepcionDetalle.findMany({
  where: {
    facturado: false,
    recepcion: { cerradaSinFactura: false },
    ocDetalle: { oc: { proveedorId } },
  },
  include: {
    ocDetalle: { include: { oc: true, requisicionDetalle: { include: { item: true } } } },
    recepcion: true,
  },
  orderBy: [{ recepcion: { fechaRecepcion: 'asc' } }, { id: 'asc' }],
})
```

Exclude `cerradaSinFactura` recepciones — see §7.7 "Recepción terminal cierre" below.

### 7.4 OC number generation

Legacy format is `OC-000001` zero-padded to 6 digits. New OCs:

```
SELECT nextval('ordenes_compra_id_seq')
```

then format `OC-${String(id).padStart(6, '0')}` and store on `numeroOc`. Sequence was reseeded by `scripts/migrate-from-sqlite.ts` — confirmed covers legacy 114-row range. No padding collisions.

### 7.5 Price discrepancy thresholds

Constants centralised in `lib/compras/price-discrepancy.ts`:

```
SOFT_WARNING = 0.005   // 0.5%
HARD_WARNING = 0.10    // 10%
```

Revisit both values with Cervi after Slice E ships (§10 open question).

### 7.6 Weighted-average cost math

For each factura line with `itemId`:

```
old = item.valorUnitario       // current avg cost
oldStock = item.stock           // current stock (already includes the recepción)
fac = factura_line.precio_neto_post_descuento
facQty = factura_line.cantidad  // = recepcionDetalle.cantidadRecibida

stockBefore = oldStock - facQty // stock as it was before the recepción

if (stockBefore + facQty) > 0:
  newAvg = (old * stockBefore + fac * facQty) / (stockBefore + facQty)
  item.valorUnitario = newAvg
  item.valorTotal    = item.stock * newAvg   // keep legacy stored column fresh
else:
  // over-drawn legacy item; skip and log a warning
```

Two facturas against the same recepción line can't happen — `RecepcionDetalle.facturado=true` is the lock.

### 7.7 State machine reference

Requisición:

```
Borrador ──submit──▶ En Revisión ──reject──▶ Rechazada (terminal)
                          │
                          ├──approve──▶ Aprobada
                          │                 │
                          │                 ├──assign-all──▶ Asignado a Proveedor
                          │                 │                      │
                          │                 │                      └──generate-ocs──▶ OC Emitida (terminal)
                          │                 │
                          └──────────────────┘
```

OC:

```
Emitida ──receive-all──▶ Completada (terminal, under normal flow)
    │
    ├──receive-some──▶ Parcialmente Recibida ──receive-rest──▶ Completada
    │
    └──cancel──▶ Cancelada (terminal)   [only allowed when no recepciones]
```

Factura: no state machine (issued once, locked). Cancellation out of scope v1.

Recepción terminal cierre (QA-037, post-Slice D):

```
Recepción (open) ──admin closes──▶ cerradaSinFactura = true (terminal)
```

Legacy `Completar remitos sin factura` path for supplier returns, free replacements, damaged-goods remitos. Admin-only on `/compras/recepciones/[id]`; requires `motivo`; stamps `cerradoPor` + `fechaCierre`. Closing does **not** write `PrecioHistorico`, does **not** update `Inventario.valorUnitario`, does **not** emit new `InventarioMovimiento` (the original recepción already did that at Stock-destino time). Only effect: closed recepciones drop out of §7.3's unfacturadas query.

## 8. States & edge cases

- **Req with a deleted inventario item.** `Inventario.delete` is already blocked when a requisición-detalle references it (Phase 3). So this state shouldn't exist. If it does (legacy drift), detail drawer shows `(ítem no encontrado)` and blocks transitions.
- **Req with a deleted proveedor.** `Proveedor.delete` blocked when `ordenes_compra` / `requisiciones_detalle` reference it (add these guards to Slice A). If a proveedor goes `estado='inactivo'`, existing assignments keep working but the Combobox filters inactive suppliers out of new selections.
- **OC with 0 lines.** Impossible via UI (Slice C transaction rolls back if a supplier group is empty). If DB drift produces one, cancel action is allowed (no recepciones to block).
- **Recepción over-reception at save (race).** Between the form render and the save, another clerk completes the OC. Detect inside the transaction (re-check `cantidadRecibida + cantidadRecibidaAhora ≤ cantidadSolicitada`) and 409 with a friendly "another user just received these lines — refresh."
- **Factura on a RecepcionDetalle that was already facturado.** `facturado=true` check inside the transaction aborts with 409. Form refresh re-filters.
- **Factura total mismatch vs sum of lines.** Warn but save. Accountants sometimes round. Log the mismatch to Sentry once we have it.
- **Factura `numeroFactura` collision.** Unique constraint → server action surfaces a field error ("ya existe una factura con ese número para este proveedor"). We don't scope uniqueness to proveedor because legacy didn't — the existing `@@unique` is global. Revisit if Cervi files two invoices with the same number (unlikely).
- **Weighted-avg on over-drawn stock.** Skip and log (§7.6). The item's `valorUnitario` stays at its prior value; accountant flags manually.
- **Concurrent "Generar OCs" on the same req.** Guard in the transaction: re-read `Requisicion.estado`; abort if not `Asignado a Proveedor`. Last-writer wins the 200.
- **Proveedor for a single line changed after save, before OC generation.** Save reflects it; audit trail captures `updatedAt` on `RequisicionDetalle` but no historical versioning (not worth it in v1).
- **Soft-delete on suppliers with history.** Not implemented. Use `estado='inactivo'` instead; that's the legacy convention.
- **Multi-currency.** Out of scope. Any factura rendered in USD gets entered as ARS post-conversion; the clerk notes the rate in `notas`. Phase 7 picks this up with `dolar_cotizaciones`.

## 9. i18n

New namespace: `compras.*` in `messages/es.json`.

- `compras.common.*` — estados compartidos (`Borrador`, `En Revisión`, `Aprobada`, `Asignado a Proveedor`, `OC Emitida`, `Rechazada`, `Emitida`, `Parcialmente Recibida`, `Completada`, `Cancelada`), prioridades, destinos (`Stock`, `Directa`), acciones (`Aprobar`, `Rechazar`, `Enviar a revisión`, `Asignar proveedores`, `Generar OCs`, `Descargar PDF`, etc.).
- `compras.requisiciones.*` — list + detail + form + empty states + validation errors.
- `compras.oc.*` — list + detail + assign flow + cancel confirmation.
- `compras.recepciones.*` — list + create + inline helpers.
- `compras.facturas.*` — list + create + discrepancy tooltips.
- `compras.pdf.*` — OC PDF labels (every visible string in the template goes here; the PDF component reads the locale from the request).

Shared with existing: `common.*`, `listados.common.*`.

No English keys — this module's users are Spanish-only. Infra-facing error messages (logged only) may be English; user-facing strings never.

## 10. Open questions / deferred

- **Price-discrepancy thresholds.** Proposing 0.5% soft / 10% hard (§7.5). Confirm with Cervi during Slice E spec walkthrough — if they want "any mismatch = hard warning" we flip the soft threshold to 0.
- **OC cancellation with recepciones.** Out of scope v1. Workaround is manual inventario ajuste. Revisit if Cervi hits it more than once post-cutover.
- **Recepción + factura cancellation.** Same as above.
- **`Jefe de Compras` role.** v1 gates approval on `Administrador`. If Cervi wants separation, add the role + migrate users — cheap.
- **Emailing the OC PDF to the supplier.** Out of scope v1 (no SMTP — parity with Listados invite-link flow). v2 once SMTP lands.
- **Multi-currency invoices.** Phase 7 Estadísticas picks this up with `dolar_cotizaciones` conversions on the read side. No v1 changes to `PrecioHistorico`.
- **"Generar OC sin requisición" direct-path.** Legacy Tkinter has a rarely-used direct-OC flow. Parking post-cutover; no data shows Cervi relies on it.
- **OC edit after emission.** Deliberately out of scope. Workflow: cancel the OC, create a new one.
- **Approval rules beyond single-step.** No multi-step approvals (e.g., amount thresholds → different approvers). If Cervi asks, add after v1 with a `nivelAprobacion` column.

## 11. Acceptance per slice

Each slice ships with:

1. `pnpm typecheck` + `pnpm lint` clean.
2. Prisma schema additive-only; migration runs clean on dev Neon + re-run on legacy snapshot preserves counts (§2.1).
3. Screenshots of every new surface in the PR description.
4. Server actions wrapped in `prisma.$transaction` where the spec calls for atomicity (Slice C generate, Slice D save, Slice E save). Verified by code review, not tests — the test harness doesn't yet simulate concurrent writes.
5. **Playwright golden paths** on staging before merge:
   - Slice A: create req → add 2 lines → submit → estado = En Revisión.
   - Slice B: approve a req → estado = Aprobada; reject another → estado = Rechazada.
   - Slice C: assign 2 lines to distinct suppliers → generate → 2 OCs created, both have a line, req = `OC Emitida`.
   - Slice D: receive half of one OC → OC = Parcialmente Recibida; receive the rest → Completada; one `inventario_movimientos` entrada per `destino=Stock` line.
   - Slice E: factura against both recepción lines → `valorUnitario` updated per the formula; lines show `facturado=true`.
6. Stakeholder walkthrough with Cervi on staging before each slice merges. Record which Cervi user walked it and what they pushed back on.
7. i18n review — no raw Spanish strings outside `messages/es.json`.
8. For Slice C: manual QA of the PDF against a real supplier layout (Cervi provides one from the legacy app for visual diff).

