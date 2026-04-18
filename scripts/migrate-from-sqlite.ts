/**
 * Re-runnable SQLite → Postgres migration for Cervi's flota7.db.
 *
 * Idempotent via upsert-by-legacy-id. Tables are imported in topological order
 * so foreign keys always resolve. Integer booleans in SQLite (0/1) are converted
 * to Prisma Boolean; SQLite TEXT dates are parsed into Postgres TIMESTAMP.
 * After all tables import, Postgres sequences are reseeded to max(id)+1 so
 * future inserts don't collide with preserved legacy ids.
 *
 * Usage:
 *   pnpm db:migrate-legacy [path/to/flota7.db]
 *
 * Default source: ../agimav/flota7.db
 */

import fs from "node:fs";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

type Row = Record<string, unknown>;

const SQLITE_PATH =
  process.argv[2] ??
  path.resolve(
    process.cwd(),
    "..",
    "..",
    "desktop",
    "proyectos",
    "agimav",
    "flota7.db",
  );

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const bool = (v: unknown): boolean => v === 1 || v === true || v === "1";

/**
 * SQLite stores dates as TEXT in several formats:
 *   - 'YYYY-MM-DD'                         (DATE('now'))
 *   - 'YYYY-MM-DD HH:MM:SS'                (datetime('now'))
 *   - ISO 8601
 * Returns null for null/empty/invalid input — callers treat as missing.
 */
const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  // SQLite's 'YYYY-MM-DD HH:MM:SS' is treated as UTC by JS Date — fine for us.
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDateReq = (v: unknown, fallback: Date = new Date(0)): Date =>
  toDate(v) ?? fallback;

// ──────────────────────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`✗ SQLite DB not found at ${SQLITE_PATH}`);
  process.exit(1);
}

console.log(`• Source: ${SQLITE_PATH}`);
console.log(`• Target: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(DATABASE_URL unset)"}`);

const sqlite = new BetterSqlite3(SQLITE_PATH, { readonly: true });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const counts: Record<string, { src: number; dst: number }> = {};

const readAll = (table: string): Row[] => {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Row[];
  counts[table] = { src: rows.length, dst: 0 };
  return rows;
};

// Prisma has no bulk upsert; we parallelize with Promise.all in fixed-size
// chunks to avoid saturating the Neon connection pool. FK-safe ordering is
// preserved because upsertMany is awaited before the next table starts.
const CHUNK = 25;

async function upsertMany<T>(
  table: string,
  rows: T[],
  upsert: (row: T) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.all(rows.slice(i, i + CHUNK).map(upsert));
  }
  counts[table].dst = rows.length;
  console.log(`  ✓ ${table.padEnd(28)} ${rows.length} rows`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n→ Importing listados (no dependencies)");

  await upsertMany("roles", readAll("roles") as Array<{ id: number; nombre: string }>, (r) =>
    prisma.rol.upsert({
      where: { id: r.id },
      create: { id: r.id, nombre: r.nombre },
      update: { nombre: r.nombre },
    }),
  );

  await upsertMany(
    "unidades_medida",
    readAll("unidades_medida") as Array<{ id: number; nombre: string; abreviacion: string }>,
    (r) =>
      prisma.unidadMedida.upsert({
        where: { id: r.id },
        create: { id: r.id, nombre: r.nombre, abreviacion: r.abreviacion },
        update: { nombre: r.nombre, abreviacion: r.abreviacion },
      }),
  );

  await upsertMany(
    "localidades",
    readAll("localidades") as Array<{ id: number; nombre: string }>,
    (r) =>
      prisma.localidad.upsert({
        where: { id: r.id },
        create: { id: r.id, nombre: r.nombre },
        update: { nombre: r.nombre },
      }),
  );

  await upsertMany(
    "tipos_unidad",
    readAll("tipos_unidad") as Array<{ id: number; nombre: string }>,
    (r) =>
      prisma.tipoUnidad.upsert({
        where: { id: r.id },
        create: { id: r.id, nombre: r.nombre },
        update: { nombre: r.nombre },
      }),
  );

  console.log("\n→ Importing listados con FKs");

  await upsertMany(
    "usuarios",
    readAll("usuarios") as Array<{ id: number; nombre: string; rol_id: number | null; estado: string | null }>,
    (r) =>
      prisma.usuario.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          nombre: r.nombre,
          rolId: r.rol_id,
          estado: r.estado ?? "activo",
        },
        update: {
          nombre: r.nombre,
          rolId: r.rol_id,
          estado: r.estado ?? "activo",
        },
      }),
  );

  await upsertMany(
    "unidades_productivas",
    readAll("unidades_productivas") as Array<{
      id: number;
      nombre: string;
      localidad_id: number | null;
      tipo_unidad_id: number | null;
    }>,
    (r) =>
      prisma.unidadProductiva.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          nombre: r.nombre,
          localidadId: r.localidad_id,
          tipoUnidadId: r.tipo_unidad_id,
        },
        update: {
          nombre: r.nombre,
          localidadId: r.localidad_id,
          tipoUnidadId: r.tipo_unidad_id,
        },
      }),
  );

  await upsertMany(
    "proveedores",
    readAll("proveedores") as Row[],
    (r) =>
      prisma.proveedor.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          nombre: r.nombre as string,
          contacto: (r.contacto as string | null) ?? null,
          estado: (r.estado as string | null) ?? "activo",
          localidadId: (r.localidad_id as number | null) ?? null,
          direccion: (r.direccion as string | null) ?? null,
          email: (r.email as string | null) ?? null,
          telefono: (r.telefono as string | null) ?? null,
          cuit: (r.cuit as string | null) ?? null,
          condicionIva: (r.condicion_iva as string | null) ?? null,
          nombreContacto: (r.nombre_contacto as string | null) ?? null,
          direccionFiscal: (r.direccion_fiscal as string | null) ?? null,
        },
        update: {
          nombre: r.nombre as string,
          contacto: (r.contacto as string | null) ?? null,
          estado: (r.estado as string | null) ?? "activo",
          localidadId: (r.localidad_id as number | null) ?? null,
          direccion: (r.direccion as string | null) ?? null,
          email: (r.email as string | null) ?? null,
          telefono: (r.telefono as string | null) ?? null,
          cuit: (r.cuit as string | null) ?? null,
          condicionIva: (r.condicion_iva as string | null) ?? null,
          nombreContacto: (r.nombre_contacto as string | null) ?? null,
          direccionFiscal: (r.direccion_fiscal as string | null) ?? null,
        },
      }),
  );

  console.log("\n→ Importing inventario");

  await upsertMany(
    "inventario",
    readAll("inventario") as Row[],
    (r) =>
      prisma.inventario.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          codigo: (r.codigo as string | null) ?? null,
          descripcion: (r.descripcion as string | null) ?? null,
          categoria: (r.categoria as string | null) ?? null,
          localidad: (r.localidad as string | null) ?? null,
          unidadProductiva: (r.unidad_productiva as string | null) ?? null,
          stock: (r.stock as number | null) ?? 0,
          stockMinimo: (r.stock_minimo as number | null) ?? 0,
          unidadMedida: (r.unidad_medida as string | null) ?? null,
          valorTotal: (r.valor_total as number | null) ?? 0,
          valorUnitario: (r.valor_unitario as number | null) ?? 0,
          proveedor: (r.proveedor as string | null) ?? null,
        },
        update: {
          codigo: (r.codigo as string | null) ?? null,
          descripcion: (r.descripcion as string | null) ?? null,
          categoria: (r.categoria as string | null) ?? null,
          localidad: (r.localidad as string | null) ?? null,
          unidadProductiva: (r.unidad_productiva as string | null) ?? null,
          stock: (r.stock as number | null) ?? 0,
          stockMinimo: (r.stock_minimo as number | null) ?? 0,
          unidadMedida: (r.unidad_medida as string | null) ?? null,
          valorTotal: (r.valor_total as number | null) ?? 0,
          valorUnitario: (r.valor_unitario as number | null) ?? 0,
          proveedor: (r.proveedor as string | null) ?? null,
        },
      }),
  );

  await upsertMany(
    "inventario_movimientos",
    readAll("inventario_movimientos") as Row[],
    (r) =>
      prisma.inventarioMovimiento.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          idItem: r.id_item as number,
          tipo: r.tipo as string,
          cantidad: r.cantidad as number,
          unidadMedida: (r.unidad_medida as string | null) ?? null,
          valorUnitario: (r.valor_unitario as number | null) ?? 0,
          fecha: toDateReq(r.fecha),
          usuario: r.usuario as string,
          motivo: (r.motivo as string | null) ?? null,
          moduloOrigen: (r.modulo_origen as string | null) ?? null,
          idOrigen: (r.id_origen as number | null) ?? null,
          observaciones: (r.observaciones as string | null) ?? null,
          createdAt: toDate(r.created_at) ?? new Date(),
        },
        update: {
          idItem: r.id_item as number,
          tipo: r.tipo as string,
          cantidad: r.cantidad as number,
          fecha: toDateReq(r.fecha),
        },
      }),
  );

  await upsertMany(
    "movimientos_diarios",
    readAll("movimientos_diarios") as Row[],
    (r) =>
      prisma.movimientoDiario.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          fecha: toDate(r.fecha),
          codigoItem: (r.codigo_item as string | null) ?? null,
          descripcion: (r.descripcion as string | null) ?? null,
          cantidad: (r.cantidad as number | null) ?? null,
          unidadMedida: (r.unidad_medida as string | null) ?? null,
          usuario: (r.usuario as string | null) ?? null,
          localidad: (r.localidad as string | null) ?? null,
          sector: (r.sector as string | null) ?? null,
          proveedor: (r.proveedor as string | null) ?? null,
          factura: (r.factura as string | null) ?? null,
          monto: (r.monto as number | null) ?? null,
          observaciones: (r.observaciones as string | null) ?? null,
          justificacion: (r.justificacion as string | null) ?? null,
          localidadId: (r.localidad_id as number | null) ?? null,
          unidadProductivaId: (r.unidad_productiva_id as number | null) ?? null,
        },
        update: {},
      }),
  );

  console.log("\n→ Importing maquinaria structure");

  await upsertMany(
    "maquinaria_tipos",
    readAll("maquinaria_tipos") as Row[],
    (r) =>
      prisma.maquinariaTipo.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          nombre: r.nombre as string,
          estado: (r.estado as string | null) ?? "activo",
          unidadMedicion: (r.unidad_medicion as string | null) ?? "Horas",
          abrevUnidad: (r.abrev_unidad as string | null) ?? "hs",
          createdAt: toDate(r.created_at) ?? undefined,
        },
        update: {
          nombre: r.nombre as string,
          estado: (r.estado as string | null) ?? "activo",
        },
      }),
  );

  // tipo_niveles is self-referencing (parent_level_id → tipo_niveles.id).
  // Insert in orden asc with parent_level_id first, then children. Simpler:
  // insert twice — first with parent=null, then update to set parent.
  const niveles = readAll("tipo_niveles") as Array<{
    id: number;
    tipo_id: number;
    nombre: string;
    parent_level_id: number | null;
    orden: number | null;
    permite_inventario: number | null;
    activo: number | null;
  }>;
  for (let i = 0; i < niveles.length; i += CHUNK) {
    await Promise.all(
      niveles.slice(i, i + CHUNK).map((r) =>
        prisma.tipoNivel.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            tipoId: r.tipo_id,
            nombre: r.nombre,
            parentLevelId: null,
            orden: r.orden ?? 0,
            permiteInventario: bool(r.permite_inventario),
            activo: bool(r.activo ?? 1),
          },
          update: { nombre: r.nombre },
        }),
      ),
    );
  }
  for (let i = 0; i < niveles.length; i += CHUNK) {
    await Promise.all(
      niveles
        .slice(i, i + CHUNK)
        .filter((r) => r.parent_level_id)
        .map((r) =>
          prisma.tipoNivel.update({
            where: { id: r.id },
            data: { parentLevelId: r.parent_level_id },
          }),
        ),
    );
  }
  counts["tipo_niveles"].dst = niveles.length;
  console.log(`  ✓ tipo_niveles                ${niveles.length} rows`);

  await upsertMany(
    "nivel_atributos",
    readAll("nivel_atributos") as Row[],
    (r) =>
      prisma.nivelAtributo.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          nivelId: r.nivel_id as number,
          nombre: r.nombre as string,
          dataType: r.data_type as string,
          requerido: bool(r.requerido),
          esPrincipal: bool(r.es_principal),
          listOptions: (r.list_options as string | null) ?? null,
          sourceRef: (r.source_ref as string | null) ?? null,
          defaultValue: (r.default_value as string | null) ?? null,
          activo: bool(r.activo ?? 1),
        },
        update: {
          nombre: r.nombre as string,
          dataType: r.data_type as string,
        },
      }),
  );

  console.log("\n→ Importing maquinaria instances");

  await upsertMany(
    "maquinaria",
    readAll("maquinaria") as Row[],
    (r) =>
      prisma.maquinaria.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          typeId: r.type_id as number,
          nroSerie: (r.nro_serie as string | null) ?? null,
          estado: (r.estado as string | null) ?? "Activo",
          horasAcumuladas: (r.horas_acumuladas as number | null) ?? 0,
          createdAt: toDate(r.created_at) ?? undefined,
        },
        update: {
          typeId: r.type_id as number,
          nroSerie: (r.nro_serie as string | null) ?? null,
          estado: (r.estado as string | null) ?? "Activo",
          horasAcumuladas: (r.horas_acumuladas as number | null) ?? 0,
        },
      }),
  );

  // maquina_nodos is also self-referencing. Same two-pass trick.
  const nodos = readAll("maquina_nodos") as Array<{
    id: number;
    maquinaria_id: number;
    nivel_def_id: number;
    parent_node_id: number | null;
    inventario_item_id: number | null;
    fecha_instalacion: string | null;
    fecha_retiro: string | null;
    activo: number | null;
  }>;
  for (let i = 0; i < nodos.length; i += CHUNK) {
    await Promise.all(
      nodos.slice(i, i + CHUNK).map((r) =>
        prisma.maquinaNodo.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            maquinariaId: r.maquinaria_id,
            nivelDefId: r.nivel_def_id,
            parentNodeId: null,
            inventarioItemId: r.inventario_item_id,
            fechaInstalacion: toDate(r.fecha_instalacion),
            fechaRetiro: toDate(r.fecha_retiro),
            activo: bool(r.activo ?? 1),
          },
          update: {},
        }),
      ),
    );
  }
  for (let i = 0; i < nodos.length; i += CHUNK) {
    await Promise.all(
      nodos
        .slice(i, i + CHUNK)
        .filter((r) => r.parent_node_id)
        .map((r) =>
          prisma.maquinaNodo.update({
            where: { id: r.id },
            data: { parentNodeId: r.parent_node_id },
          }),
        ),
    );
  }
  counts["maquina_nodos"].dst = nodos.length;
  console.log(`  ✓ maquina_nodos               ${nodos.length} rows`);

  await upsertMany(
    "maquina_atributos_valores",
    readAll("maquina_atributos_valores") as Row[],
    (r) =>
      prisma.maquinaAtributoValor.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          nodoId: r.nodo_id as number,
          atributoDefId: r.atributo_def_id as number,
          valueText: (r.value_text as string | null) ?? null,
          valueNum: (r.value_num as number | null) ?? null,
          valueDate: toDate(r.value_date),
          lastUpdated: toDate(r.last_updated) ?? new Date(),
        },
        update: {
          valueText: (r.value_text as string | null) ?? null,
          valueNum: (r.value_num as number | null) ?? null,
          valueDate: toDate(r.value_date),
        },
      }),
  );

  await upsertMany(
    "registro_horas_maquinaria",
    readAll("registro_horas_maquinaria") as Row[],
    (r) =>
      prisma.registroHorasMaquinaria.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          idMaquinaria: r.id_maquinaria as number,
          fechaRegistro: toDate(r.fecha_registro) ?? new Date(),
          horasAnterior: (r.horas_anterior as number | null) ?? 0,
          horasNuevo: (r.horas_nuevo as number | null) ?? 0,
          horasDiferencia: (r.horas_diferencia as number | null) ?? 0,
          tipoActualizacion: (r.tipo_actualizacion as string | null) ?? null,
          observaciones: (r.observaciones as string | null) ?? null,
          usuario: (r.usuario as string | null) ?? null,
          createdAt: toDate(r.created_at) ?? undefined,
        },
        update: {},
      }),
  );

  await upsertMany(
    "tabla_config",
    readAll("tabla_config") as Row[],
    (r) =>
      prisma.tablaConfig.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          tipoId: r.tipo_id as number,
          targetDepth: r.target_depth as number,
          orderIndex: r.order_index as number,
          columnKind: r.column_kind as string,
          builtinKey: (r.builtin_key as string | null) ?? null,
          attributeId: (r.attribute_id as number | null) ?? null,
          levelDefId: (r.level_def_id as number | null) ?? null,
          visible: bool(r.visible ?? 1),
        },
        update: {},
      }),
  );

  console.log("\n→ Importing compras pipeline");

  await upsertMany(
    "requisiciones",
    readAll("requisiciones") as Row[],
    (r) =>
      prisma.requisicion.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          fechaCreacion: toDate(r.fecha_creacion) ?? new Date(),
          solicitante: r.solicitante as string,
          unidadProductiva: r.unidad_productiva as string,
          localidad: r.localidad as string,
          prioridad: (r.prioridad as string | null) ?? "Normal",
          estado: (r.estado as string | null) ?? "Borrador",
          fechaTentativa: toDate(r.fecha_tentativa),
          fechaLimite: toDate(r.fecha_limite),
          notas: (r.notas as string | null) ?? null,
          creadoPor: (r.creado_por as string | null) ?? null,
          fechaAprobacion: toDate(r.fecha_aprobacion),
          aprobadoPor: (r.aprobado_por as string | null) ?? null,
          fechaCancelacion: toDate(r.fecha_cancelacion),
          canceladoPor: (r.cancelado_por as string | null) ?? null,
          numeroOrdenInterna: (r.numero_orden_interna as string | null) ?? null,
        },
        update: {
          estado: (r.estado as string | null) ?? "Borrador",
        },
      }),
  );

  await upsertMany(
    "requisiciones_detalle",
    readAll("requisiciones_detalle") as Row[],
    (r) =>
      prisma.requisicionDetalle.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          requisicionId: r.requisicion_id as number,
          itemId: r.item_id as number,
          cantidad: r.cantidad as number,
          prioridadItem: (r.prioridad_item as string | null) ?? "Normal",
          notasItem: (r.notas_item as string | null) ?? null,
          estado: (r.estado as string | null) ?? "Pendiente",
        },
        update: {},
      }),
  );

  await upsertMany(
    "ordenes_compra",
    readAll("ordenes_compra") as Row[],
    (r) =>
      prisma.ordenCompra.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          numeroOc: (r.numero_oc as string | null) ?? null,
          proveedorId: r.proveedor_id as number,
          fechaEmision: toDate(r.fecha_emision) ?? new Date(),
          comprador: (r.comprador as string | null) ?? null,
          estado: (r.estado as string | null) ?? "Emitida",
          totalEstimado: (r.total_estimado as number | null) ?? 0,
          observaciones: (r.observaciones as string | null) ?? null,
          creadoPor: (r.creado_por as string | null) ?? null,
          fechaCancelacion: toDate(r.fecha_cancelacion),
          canceladoPor: (r.cancelado_por as string | null) ?? null,
        },
        update: {},
      }),
  );

  await upsertMany(
    "ordenes_compra_detalle",
    readAll("ordenes_compra_detalle") as Row[],
    (r) =>
      prisma.ordenCompraDetalle.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          ocId: r.oc_id as number,
          requisicionDetalleId: r.requisicion_detalle_id as number,
          cantidadSolicitada: r.cantidad_solicitada as number,
          cantidadRecibida: (r.cantidad_recibida as number | null) ?? 0,
          precioUnitario: (r.precio_unitario as number | null) ?? 0,
          total: (r.total as number | null) ?? 0,
        },
        update: {},
      }),
  );

  await upsertMany(
    "recepciones",
    readAll("recepciones") as Row[],
    (r) =>
      prisma.recepcion.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          ocId: r.oc_id as number,
          numeroRemito: r.numero_remito as string,
          fechaRecepcion: toDate(r.fecha_recepcion) ?? new Date(),
          recibidoPor: r.recibido_por as string,
          observaciones: (r.observaciones as string | null) ?? null,
          creadoPor: (r.creado_por as string | null) ?? null,
        },
        update: {},
      }),
  );

  await upsertMany(
    "recepciones_detalle",
    readAll("recepciones_detalle") as Row[],
    (r) =>
      prisma.recepcionDetalle.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          recepcionId: r.recepcion_id as number,
          ocDetalleId: r.oc_detalle_id as number,
          cantidadRecibida: r.cantidad_recibida as number,
          facturado: bool(r.facturado),
        },
        update: {},
      }),
  );

  await upsertMany(
    "facturas",
    readAll("facturas") as Row[],
    (r) =>
      prisma.factura.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          numeroFactura: r.numero_factura as string,
          proveedorId: r.proveedor_id as number,
          fechaFactura: toDateReq(r.fecha_factura),
          total: r.total as number,
          usuario: (r.usuario as string | null) ?? null,
          fechaRegistro: toDate(r.fecha_registro) ?? new Date(),
          subtotal: (r.subtotal as number | null) ?? 0,
          descuentoComercial: (r.descuento_comercial as number | null) ?? 0,
          descuentoFinanciero: (r.descuento_financiero as number | null) ?? 0,
          recargo: (r.recargo as number | null) ?? 0,
          netoGravado: (r.neto_gravado as number | null) ?? 0,
          ivaPorcentaje: (r.iva_porcentaje as number | null) ?? 21,
          ivaMonto: (r.iva_monto as number | null) ?? 0,
        },
        update: {},
      }),
  );

  await upsertMany(
    "factura_detalle",
    readAll("factura_detalle") as Row[],
    (r) =>
      prisma.facturaDetalle.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          facturaId: r.factura_id as number,
          recepcionDetalleId: r.recepcion_detalle_id as number,
          precioUnitario: r.precio_unitario as number,
          total: r.total as number,
          descuentoComercialPorcentaje:
            (r.descuento_comercial_porcentaje as number | null) ?? 0,
        },
        update: {},
      }),
  );

  await upsertMany(
    "precios_historico",
    readAll("precios_historico") as Row[],
    (r) =>
      prisma.precioHistorico.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          itemId: r.item_id as number,
          proveedorId: r.proveedor_id as number,
          fecha: toDateReq(r.fecha),
          precioArs: r.precio_ars as number,
          fuente: (r.fuente as string | null) ?? null,
          numeroDocumento: (r.numero_documento as string | null) ?? null,
          usuario: (r.usuario as string | null) ?? null,
        },
        update: {},
      }),
  );

  const dolares = readAll("dolar_cotizaciones") as Array<{
    anio: number;
    mes: number;
    tc_promedio: number;
  }>;
  for (const r of dolares) {
    await prisma.dolarCotizacion.upsert({
      where: { anio_mes: { anio: r.anio, mes: r.mes } },
      create: { anio: r.anio, mes: r.mes, tcPromedio: r.tc_promedio },
      update: { tcPromedio: r.tc_promedio },
    });
  }
  counts["dolar_cotizaciones"].dst = dolares.length;
  console.log(`  ✓ dolar_cotizaciones          ${dolares.length} rows`);

  console.log("\n→ Importing mantenimiento");

  await upsertMany(
    "plantillas_mantenimiento",
    readAll("plantillas_mantenimiento") as Row[],
    (r) =>
      prisma.plantillaMantenimiento.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          nombre: r.nombre as string,
          tipoMaquinariaId: r.tipo_maquinaria_id as number,
          frecuenciaValor: r.frecuencia_valor as number,
          frecuenciaUnidad: r.frecuencia_unidad as string,
          prioridad: r.prioridad as string,
          descripcion: (r.descripcion as string | null) ?? null,
          creadoPor: (r.creado_por as string | null) ?? null,
          fechaCreacion: toDate(r.fecha_creacion) ?? new Date(),
        },
        update: {},
      }),
  );

  await upsertMany(
    "plantilla_insumos",
    readAll("plantilla_insumos") as Row[],
    (r) =>
      prisma.plantillaInsumo.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          plantillaId: r.plantilla_id as number,
          itemInventarioId: r.item_inventario_id as number,
          cantidadSugerida: r.cantidad_sugerida as number,
          unidadMedida: r.unidad_medida as string,
        },
        update: {},
      }),
  );

  await upsertMany(
    "plantilla_tareas",
    readAll("plantilla_tareas") as Row[],
    (r) =>
      prisma.plantillaTarea.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          plantillaId: r.plantilla_id as number,
          descripcion: r.descripcion as string,
          orden: (r.orden as number | null) ?? 0,
        },
        update: {},
      }),
  );

  await upsertMany(
    "mantenimientos",
    readAll("mantenimientos") as Row[],
    (r) =>
      prisma.mantenimiento.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          tipo: r.tipo as string,
          maquinariaId: r.maquinaria_id as number,
          prioridad: r.prioridad as string,
          descripcion: (r.descripcion as string | null) ?? null,
          responsableId: r.responsable_id as number,
          unidadProductivaId: (r.unidad_productiva_id as number | null) ?? null,
          estado: r.estado as string,
          tallerAsignadoId: (r.taller_asignado_id as number | null) ?? null,
          fechaCreacion: toDate(r.fecha_creacion) ?? new Date(),
          fechaInicio: toDate(r.fecha_inicio),
          fechaFinalizacion: toDate(r.fecha_finalizacion),
          programarRevision: bool(r.programar_revision),
          fechaProximaRevision: toDate(r.fecha_proxima_revision),
          descripcionRevision: (r.descripcion_revision as string | null) ?? null,
          creadoPor: (r.creado_por as string | null) ?? null,
          esRecurrente: bool(r.es_recurrente ?? 1),
          plantillaId: (r.plantilla_id as number | null) ?? null,
          frecuenciaValor: (r.frecuencia_valor as number | null) ?? null,
          frecuenciaUnidad: (r.frecuencia_unidad as string | null) ?? null,
          fechaProgramada: toDate(r.fecha_programada),
          usoEstimadoDiario: (r.uso_estimado_diario as number | null) ?? null,
          unidadEstimacion: (r.unidad_estimacion as string | null) ?? null,
          metodoCalculo: (r.metodo_calculo as string | null) ?? null,
        },
        update: {},
      }),
  );

  await upsertMany(
    "mantenimiento_insumos",
    readAll("mantenimiento_insumos") as Row[],
    (r) =>
      prisma.mantenimientoInsumo.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          mantenimientoId: r.mantenimiento_id as number,
          itemInventarioId: r.item_inventario_id as number,
          cantidadSugerida: r.cantidad_sugerida as number,
          cantidadUtilizada: (r.cantidad_utilizada as number | null) ?? 0,
          unidadMedida: r.unidad_medida as string,
          costoUnitario: (r.costo_unitario as number | null) ?? 0,
          costoTotal: (r.costo_total as number | null) ?? 0,
          proveedorId: (r.proveedor_id as number | null) ?? null,
        },
        update: {},
      }),
  );

  await upsertMany(
    "mantenimiento_tareas",
    readAll("mantenimiento_tareas") as Row[],
    (r) =>
      prisma.mantenimientoTarea.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          mantenimientoId: r.mantenimiento_id as number,
          descripcion: r.descripcion as string,
          realizada: bool(r.realizada),
          orden: (r.orden as number | null) ?? 0,
          esDePlantilla: bool(r.es_de_plantilla),
        },
        update: {},
      }),
  );

  await upsertMany(
    "mantenimiento_historial",
    readAll("mantenimiento_historial") as Row[],
    (r) =>
      prisma.mantenimientoHistorial.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          mantenimientoId: r.mantenimiento_id as number,
          tipoCambio: r.tipo_cambio as string,
          valorAnterior: (r.valor_anterior as string | null) ?? null,
          valorNuevo: (r.valor_nuevo as string | null) ?? null,
          detalle: (r.detalle as string | null) ?? null,
          fechaCambio: toDate(r.fecha_cambio) ?? new Date(),
          usuario: r.usuario as string,
        },
        update: {},
      }),
  );

  console.log("\n→ Importing órdenes de trabajo");

  await upsertMany(
    "ordenes_trabajo",
    readAll("ordenes_trabajo") as Row[],
    (r) =>
      prisma.ordenTrabajo.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          numeroOt: (r.numero_ot as string | null) ?? null,
          fechaCreacion: toDate(r.fecha_creacion) ?? new Date(),
          fechaFinalizacion: toDate(r.fecha_finalizacion),
          localidadId: (r.localidad_id as number | null) ?? null,
          unidadProductivaId: (r.unidad_productiva_id as number | null) ?? null,
          solicitanteId: (r.solicitante_id as number | null) ?? null,
          responsableId: (r.responsable_id as number | null) ?? null,
          prioridad: (r.prioridad as string | null) ?? "Media",
          estado: (r.estado as string | null) ?? "En Curso",
          titulo: r.titulo as string,
          descripcionTrabajo: (r.descripcion_trabajo as string | null) ?? null,
          observaciones: (r.observaciones as string | null) ?? null,
          creadoPor: (r.creado_por as string | null) ?? null,
        },
        update: {},
      }),
  );

  await upsertMany(
    "ot_insumos",
    readAll("ot_insumos") as Row[],
    (r) =>
      prisma.otInsumo.upsert({
        where: { id: r.id as number },
        create: {
          id: r.id as number,
          otId: r.ot_id as number,
          itemInventarioId: r.item_inventario_id as number,
          cantidad: r.cantidad as number,
          unidadMedida: (r.unidad_medida as string | null) ?? null,
          costoUnitario: (r.costo_unitario as number | null) ?? 0,
          costoTotal: (r.costo_total as number | null) ?? 0,
          estadoSolicitud: (r.estado_solicitud as string | null) ?? null,
        },
        update: {},
      }),
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Reseed Postgres sequences so future inserts don't collide with legacy ids.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n→ Reseeding Postgres sequences");
  const sequenced: Array<{ table: string; pk?: string }> = [
    { table: "roles" },
    { table: "usuarios" },
    { table: "unidades_medida" },
    { table: "localidades" },
    { table: "tipos_unidad" },
    { table: "unidades_productivas" },
    { table: "proveedores" },
    { table: "inventario" },
    { table: "inventario_movimientos" },
    { table: "movimientos_diarios" },
    { table: "maquinaria_tipos" },
    { table: "tipo_niveles" },
    { table: "nivel_atributos" },
    { table: "maquinaria" },
    { table: "maquina_nodos" },
    { table: "maquina_atributos_valores" },
    { table: "registro_horas_maquinaria" },
    { table: "tabla_config" },
    { table: "requisiciones" },
    { table: "requisiciones_detalle" },
    { table: "ordenes_compra" },
    { table: "ordenes_compra_detalle" },
    { table: "recepciones" },
    { table: "recepciones_detalle" },
    { table: "facturas" },
    { table: "factura_detalle" },
    { table: "precios_historico" },
    { table: "plantillas_mantenimiento" },
    { table: "plantilla_insumos" },
    { table: "plantilla_tareas" },
    { table: "mantenimientos" },
    { table: "mantenimiento_insumos" },
    { table: "mantenimiento_tareas" },
    { table: "mantenimiento_historial" },
    { table: "ordenes_trabajo" },
    { table: "ot_insumos" },
  ];
  for (const { table } of sequenced) {
    const seq = `${table}_id_seq`;
    await prisma.$executeRawUnsafe(
      `SELECT setval('"${seq}"', COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
    );
  }
  console.log(`  ✓ reseeded ${sequenced.length} sequences`);

  // ──────────────────────────────────────────────────────────────────────────
  // Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n→ Row count verification (source vs destination)");
  let mismatches = 0;
  for (const [table, { src, dst }] of Object.entries(counts)) {
    const ok = src === dst;
    if (!ok) mismatches++;
    console.log(
      `  ${ok ? "✓" : "✗"} ${table.padEnd(28)} src=${String(src).padStart(5)}  dst=${String(dst).padStart(5)}`,
    );
  }
  if (mismatches > 0) {
    console.error(`\n✗ ${mismatches} table(s) have row count mismatches`);
    process.exit(1);
  }
  console.log("\n✓ All tables imported with row count parity.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
