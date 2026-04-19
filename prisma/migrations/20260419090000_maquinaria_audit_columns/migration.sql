-- Phase 4 Slice A — nullable created_by FK on maquinaria_tipos and maquinaria.
-- created_at / updated_at already existed from the init migration.

ALTER TABLE "maquinaria_tipos" ADD COLUMN "created_by" INTEGER;
ALTER TABLE "maquinaria"       ADD COLUMN "created_by" INTEGER;

ALTER TABLE "maquinaria_tipos"
  ADD CONSTRAINT "maquinaria_tipos_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maquinaria"
  ADD CONSTRAINT "maquinaria_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
