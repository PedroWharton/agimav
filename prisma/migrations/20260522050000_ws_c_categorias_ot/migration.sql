-- WS-C · Categorías de Orden de Trabajo — catálogo configurable.
-- Migración aditiva: tabla nueva + columna FK nullable en ordenes_trabajo.

-- CreateTable
CREATE TABLE "categorias_ot" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "categorias_ot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_ot_nombre_key" ON "categorias_ot"("nombre");

-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN "categoria_id" INTEGER;

-- CreateIndex
CREATE INDEX "ordenes_trabajo_categoria_id_idx" ON "ordenes_trabajo"("categoria_id");

-- AddForeignKey
ALTER TABLE "categorias_ot" ADD CONSTRAINT "categorias_ot_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_ot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed fallback "Otros" (siempre disponible en el form de OT).
INSERT INTO "categorias_ot" ("nombre", "updated_at")
VALUES ('Otros', CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO NOTHING;
