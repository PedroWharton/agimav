-- Normalize Maquinaria.estado casing. flota7.db stored "Activo" capitalized,
-- but every other entity in the schema (Usuario, Proveedor, MaquinariaTipo)
-- uses lowercase. The mismatch caused queries filtering by estado="activo" to
-- silently return empty máquina lists. Lowercase the data and the column
-- default so the schema is consistent across all entities.
UPDATE "maquinaria" SET estado = LOWER(estado);

-- AlterTable
ALTER TABLE "inventario" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "maquinaria" ALTER COLUMN "estado" SET DEFAULT 'activo';
