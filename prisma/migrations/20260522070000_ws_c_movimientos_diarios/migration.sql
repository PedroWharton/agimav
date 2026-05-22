-- WS-C · Movimientos diarios — registro liviano (cabecera + líneas).
-- La tabla legacy `movimientos_diarios` es plana (un ítem por fila). Se archiva,
-- se crean las tablas estructuradas y se reagrupan las 217 filas legacy en
-- cabeceras (una por día + usuario + sector + localidad + UP) con sus líneas.
-- PARCIALMENTE DESTRUCTIVA: dropea la tabla legacy al final — branch de Neon
-- de backup obligatorio (ver runbook).
--
-- Paso 1 idempotente (ALTER ... IF EXISTS / DROP ... IF EXISTS): permite
-- re-correr la migración si una corrida previa quedó a mitad de camino
-- (RENAME aplicado, CREATE TABLE no).

-- 1. Archivar la tabla plana legacy. RENAME no renombra el índice de la PK ni
--    la secuencia, así que se liberan esos nombres para poder recrear la tabla
--    `movimientos_diarios`.
ALTER TABLE IF EXISTS "movimientos_diarios" RENAME TO "movimientos_diarios_legacy";
ALTER TABLE IF EXISTS "movimientos_diarios_legacy" DROP CONSTRAINT IF EXISTS "movimientos_diarios_pkey";
ALTER SEQUENCE IF EXISTS "movimientos_diarios_id_seq" RENAME TO "movimientos_diarios_legacy_id_seq";

-- 2. Cabecera.
CREATE TABLE "movimientos_diarios" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "usuario" TEXT,
    "sector" TEXT,
    "localidad" TEXT,
    "unidad_productiva_id" INTEGER,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "movimientos_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_diarios_fecha_idx" ON "movimientos_diarios"("fecha");

-- 3. Líneas.
CREATE TABLE "movimientos_diarios_lineas" (
    "id" SERIAL NOT NULL,
    "movimiento_id" INTEGER NOT NULL,
    "item_inventario_id" INTEGER,
    "codigo_item" TEXT,
    "descripcion" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidad_medida" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'consumible',
    "devuelto" BOOLEAN NOT NULL DEFAULT false,
    "fecha_devolucion" TIMESTAMP(3),
    "monto" DOUBLE PRECISION,
    "proveedor" TEXT,
    "factura" TEXT,
    "justificacion" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "movimientos_diarios_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_diarios_lineas_movimiento_id_idx" ON "movimientos_diarios_lineas"("movimiento_id");

-- CreateIndex
CREATE INDEX "movimientos_diarios_lineas_item_inventario_id_idx" ON "movimientos_diarios_lineas"("item_inventario_id");

-- AddForeignKey
ALTER TABLE "movimientos_diarios" ADD CONSTRAINT "movimientos_diarios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_diarios_lineas" ADD CONSTRAINT "movimientos_diarios_lineas_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos_diarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_diarios_lineas" ADD CONSTRAINT "movimientos_diarios_lineas_item_inventario_id_fkey" FOREIGN KEY ("item_inventario_id") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Backfill cabeceras: una por (día, usuario, sector, localidad, UP).
INSERT INTO "movimientos_diarios"
    ("fecha", "usuario", "sector", "localidad", "unidad_productiva_id", "created_at")
SELECT DISTINCT
    date_trunc('day', l."fecha"),
    l."usuario",
    l."sector",
    l."localidad",
    l."unidad_productiva_id",
    CURRENT_TIMESTAMP
FROM "movimientos_diarios_legacy" l
WHERE l."fecha" IS NOT NULL;

-- 5. Backfill líneas: cada fila legacy se une a su cabecera por la clave de
--    agrupación (IS NOT DISTINCT FROM trata NULL = NULL). El ítem de inventario
--    se resuelve por código cuando existe; legacy todo nace consumible.
INSERT INTO "movimientos_diarios_lineas"
    ("movimiento_id", "item_inventario_id", "codigo_item", "descripcion",
     "cantidad", "unidad_medida", "tipo", "monto", "proveedor", "factura",
     "justificacion", "observaciones")
SELECT
    r."id",
    inv."id",
    l."codigo_item",
    l."descripcion",
    COALESCE(l."cantidad", 0),
    l."unidad_medida",
    'consumible',
    l."monto",
    l."proveedor",
    l."factura",
    l."justificacion",
    l."observaciones"
FROM "movimientos_diarios_legacy" l
JOIN "movimientos_diarios" r
    ON r."fecha" = date_trunc('day', l."fecha")
    AND r."usuario" IS NOT DISTINCT FROM l."usuario"
    AND r."sector" IS NOT DISTINCT FROM l."sector"
    AND r."localidad" IS NOT DISTINCT FROM l."localidad"
    AND r."unidad_productiva_id" IS NOT DISTINCT FROM l."unidad_productiva_id"
LEFT JOIN "inventario" inv ON inv."codigo" = l."codigo_item"
WHERE l."fecha" IS NOT NULL;

-- 6. Dropear la tabla legacy (datos ya migrados).
DROP TABLE "movimientos_diarios_legacy";
