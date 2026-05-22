-- AlterTable
ALTER TABLE "recepciones_detalle" ADD COLUMN "precio_unitario" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "mantenimiento_insumos" ADD COLUMN "precio_pendiente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ot_insumos" ADD COLUMN "precio_pendiente" BOOLEAN NOT NULL DEFAULT false;
