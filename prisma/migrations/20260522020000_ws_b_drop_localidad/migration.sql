-- WS-B · Eliminar el modelo Localidad.
-- `localidad` deja de ser una tabla/catálogo y pasa a ser texto plano en
-- unidades_productivas, proveedores y ordenes_trabajo. El probe (2026-05-22)
-- confirmó: 9 localidades, 0 huérfanos problemáticos, ordenes_trabajo.localidad
-- siempre coincide con up.localidad (derivable). movimientos_diarios.localidad_id
-- es una columna huérfana (sin FK, 11/217 filas) — el texto `localidad` ya existe.

-- 1. Columnas de texto nuevas
ALTER TABLE "unidades_productivas" ADD COLUMN "localidad" TEXT;
ALTER TABLE "proveedores"          ADD COLUMN "localidad" TEXT;
ALTER TABLE "ordenes_trabajo"      ADD COLUMN "localidad" TEXT;

-- 2. Backfill del nombre desde la tabla localidades antes de dropearla
UPDATE "unidades_productivas" u SET "localidad" = l."nombre"
  FROM "localidades" l WHERE u."localidad_id" = l."id";
UPDATE "proveedores" p SET "localidad" = l."nombre"
  FROM "localidades" l WHERE p."localidad_id" = l."id";
UPDATE "ordenes_trabajo" o SET "localidad" = l."nombre"
  FROM "localidades" l WHERE o."localidad_id" = l."id";

-- 3. Dropear FKs, índices y columnas localidad_id
ALTER TABLE "unidades_productivas" DROP CONSTRAINT IF EXISTS "unidades_productivas_localidad_id_fkey";
ALTER TABLE "unidades_productivas" DROP COLUMN "localidad_id";

ALTER TABLE "proveedores" DROP CONSTRAINT IF EXISTS "proveedores_localidad_id_fkey";
DROP INDEX IF EXISTS "proveedores_localidad_id_idx";
ALTER TABLE "proveedores" DROP COLUMN "localidad_id";

ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT IF EXISTS "ordenes_trabajo_localidad_id_fkey";
ALTER TABLE "ordenes_trabajo" DROP COLUMN "localidad_id";

-- 4. Columna huérfana de movimientos_diarios (el texto `localidad` ya existe)
ALTER TABLE "movimientos_diarios" DROP COLUMN "localidad_id";

-- 5. Dropear la tabla localidades
DROP TABLE "localidades";
