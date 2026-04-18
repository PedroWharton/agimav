-- Backfill-friendly audit columns for the five listados tables missing them,
-- plus nullable created_by FK on all seven listados tables.
-- Also enables the unaccent extension for accent-insensitive search.

-- Enable unaccent for ILIKE search on proveedores/usuarios/etc.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- AlterTable — give updated_at a default so existing rows backfill cleanly.
ALTER TABLE "localidades"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" INTEGER;

ALTER TABLE "proveedores"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" INTEGER;

ALTER TABLE "tipos_unidad"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" INTEGER;

ALTER TABLE "unidades_medida"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" INTEGER;

ALTER TABLE "unidades_productivas"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" INTEGER;

-- created_by only for the two tables that already had audit columns
ALTER TABLE "roles" ADD COLUMN "created_by" INTEGER;
ALTER TABLE "usuarios" ADD COLUMN "created_by" INTEGER;

-- Foreign keys — all ON DELETE SET NULL so deactivating an admin doesn't cascade
ALTER TABLE "roles"
  ADD CONSTRAINT "roles_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "unidades_medida"
  ADD CONSTRAINT "unidades_medida_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "localidades"
  ADD CONSTRAINT "localidades_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tipos_unidad"
  ADD CONSTRAINT "tipos_unidad_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "unidades_productivas"
  ADD CONSTRAINT "unidades_productivas_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proveedores"
  ADD CONSTRAINT "proveedores_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
