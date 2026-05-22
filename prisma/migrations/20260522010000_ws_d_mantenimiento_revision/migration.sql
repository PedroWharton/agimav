-- CreateTable
CREATE TABLE "mantenimiento_revisiones" (
    "id" SERIAL NOT NULL,
    "mantenimiento_id" INTEGER NOT NULL,
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha_realizada" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mantenimiento_revisiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mantenimiento_revisiones_mantenimiento_id_idx" ON "mantenimiento_revisiones"("mantenimiento_id");

-- AddForeignKey
ALTER TABLE "mantenimiento_revisiones" ADD CONSTRAINT "mantenimiento_revisiones_mantenimiento_id_fkey" FOREIGN KEY ("mantenimiento_id") REFERENCES "mantenimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
