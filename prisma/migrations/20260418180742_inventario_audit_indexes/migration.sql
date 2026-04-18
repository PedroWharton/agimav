-- Inventario audit columns + movement actor + composite indexes + unaccent search index.

-- Ensure unaccent is available (belt-and-suspenders; listados migration already creates it,
-- but Prisma's shadow DB on Neon may not inherit reliably).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Swap single-column movement indexes for composites that match our query shape.
DROP INDEX "inventario_movimientos_fecha_idx";
DROP INDEX "inventario_movimientos_id_item_idx";
DROP INDEX "inventario_movimientos_modulo_origen_idx";

-- Inventario audit columns. Defaults applied to backfill the 672 existing rows.
ALTER TABLE "inventario"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" INTEGER;

-- Movement actor column — nullable so legacy rows survive.
ALTER TABLE "inventario_movimientos" ADD COLUMN "created_by" INTEGER;

-- Listados updated_at defaults were used only to backfill during the previous migration;
-- Prisma manages future writes via @updatedAt.
ALTER TABLE "localidades" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "proveedores" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "tipos_unidad" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "unidades_medida" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "unidades_productivas" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Composite indexes (replace the single-column ones dropped above).
CREATE INDEX "inventario_movimientos_id_item_fecha_idx" ON "inventario_movimientos"("id_item", "fecha" DESC);
CREATE INDEX "inventario_movimientos_fecha_idx" ON "inventario_movimientos"("fecha" DESC);
CREATE INDEX "inventario_movimientos_modulo_origen_fecha_idx" ON "inventario_movimientos"("modulo_origen", "fecha" DESC);

-- Unaccent expression index on descripcion. IMMUTABLE wrapper so the expression is indexable
-- (unaccent() is STABLE on its own because it depends on a dictionary). Function is schema-
-- qualified so it resolves regardless of search_path at call time.
CREATE OR REPLACE FUNCTION public.f_unaccent_lower(text) RETURNS text AS $$
  SELECT lower(public.unaccent($1));
$$ LANGUAGE sql IMMUTABLE;

CREATE INDEX "inventario_descripcion_unaccent_idx"
  ON "inventario" (public.f_unaccent_lower("descripcion"));

-- Foreign keys.
ALTER TABLE "inventario"
  ADD CONSTRAINT "inventario_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventario_movimientos"
  ADD CONSTRAINT "inventario_movimientos_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
