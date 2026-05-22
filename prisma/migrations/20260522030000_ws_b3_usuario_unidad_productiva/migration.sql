-- WS-B3 · Asignación de Unidades Productivas por usuario (RBAC per-UP).
-- Tabla aditiva: nada existente se toca. Un usuario sin filas aquí ve todo.

-- CreateTable
CREATE TABLE "usuario_unidades_productivas" (
    "usuario_id" INTEGER NOT NULL,
    "unidad_productiva_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "usuario_unidades_productivas_pkey" PRIMARY KEY ("usuario_id","unidad_productiva_id")
);

-- CreateIndex
CREATE INDEX "usuario_unidades_productivas_usuario_id_idx" ON "usuario_unidades_productivas"("usuario_id");

-- CreateIndex
CREATE INDEX "usuario_unidades_productivas_unidad_productiva_id_idx" ON "usuario_unidades_productivas"("unidad_productiva_id");

-- AddForeignKey
ALTER TABLE "usuario_unidades_productivas" ADD CONSTRAINT "usuario_unidades_productivas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidades_productivas" ADD CONSTRAINT "usuario_unidades_productivas_unidad_productiva_id_fkey" FOREIGN KEY ("unidad_productiva_id") REFERENCES "unidades_productivas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidades_productivas" ADD CONSTRAINT "usuario_unidades_productivas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
