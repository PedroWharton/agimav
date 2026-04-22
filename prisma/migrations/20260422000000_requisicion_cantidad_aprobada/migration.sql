-- Partial approval: add nullable approved-quantity to requisicion detalle.
-- Null means "use cantidad" (legacy rows unaffected). When set, OC generation
-- and the /compras/oc aggregation use this value instead of cantidad.
ALTER TABLE "requisiciones_detalle" ADD COLUMN "cantidad_aprobada" DOUBLE PRECISION;
