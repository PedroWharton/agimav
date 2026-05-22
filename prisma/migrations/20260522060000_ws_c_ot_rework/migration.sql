-- WS-C · OT rework — fecha programada + duración estimada (día completo).
-- Migración aditiva: dos columnas nullable en ordenes_trabajo.

-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN "fecha_programada" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN "duracion_dias" DOUBLE PRECISION;
