-- WS-C · Servicios externos — catálogo de proveedores de servicio + líneas de
-- servicio externo enganchables a un Mantenimiento o a una Orden de Trabajo.
-- Migración aditiva: no toca nada existente.

-- CreateTable
CREATE TABLE "proveedores_servicio" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cuit" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "proveedores_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_externos" (
    "id" SERIAL NOT NULL,
    "proveedor_servicio_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precio_pendiente" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3),
    "mantenimiento_id" INTEGER,
    "ot_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "servicios_externos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicios_externos_proveedor_servicio_id_idx" ON "servicios_externos"("proveedor_servicio_id");

-- CreateIndex
CREATE INDEX "servicios_externos_mantenimiento_id_idx" ON "servicios_externos"("mantenimiento_id");

-- CreateIndex
CREATE INDEX "servicios_externos_ot_id_idx" ON "servicios_externos"("ot_id");

-- AddForeignKey
ALTER TABLE "proveedores_servicio" ADD CONSTRAINT "proveedores_servicio_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_externos" ADD CONSTRAINT "servicios_externos_proveedor_servicio_id_fkey" FOREIGN KEY ("proveedor_servicio_id") REFERENCES "proveedores_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_externos" ADD CONSTRAINT "servicios_externos_mantenimiento_id_fkey" FOREIGN KEY ("mantenimiento_id") REFERENCES "mantenimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_externos" ADD CONSTRAINT "servicios_externos_ot_id_fkey" FOREIGN KEY ("ot_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_externos" ADD CONSTRAINT "servicios_externos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
