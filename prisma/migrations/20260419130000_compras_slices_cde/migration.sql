-- Slice C: supplier assignment persisted on requisicion line
ALTER TABLE "requisiciones_detalle" ADD COLUMN "proveedor_asignado_id" INTEGER;
CREATE INDEX "requisiciones_detalle_proveedor_asignado_id_idx" ON "requisiciones_detalle"("proveedor_asignado_id");
ALTER TABLE "requisiciones_detalle"
  ADD CONSTRAINT "requisiciones_detalle_proveedor_asignado_id_fkey"
  FOREIGN KEY ("proveedor_asignado_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: legacy 'Vinculada OC' lines inherit their OC's proveedor so audit isn't empty.
UPDATE "requisiciones_detalle" rd
SET "proveedor_asignado_id" = oc."proveedor_id"
FROM "ordenes_compra_detalle" ocd
JOIN "ordenes_compra" oc ON oc."id" = ocd."oc_id"
WHERE rd."id" = ocd."requisicion_detalle_id"
  AND rd."proveedor_asignado_id" IS NULL;

-- Slice D: per-movimiento destino (Stock | Directa), nullable for legacy parity.
ALTER TABLE "inventario_movimientos" ADD COLUMN "destino" TEXT;
