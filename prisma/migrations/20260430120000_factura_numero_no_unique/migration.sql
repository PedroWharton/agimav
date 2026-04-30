-- Allow duplicate factura numbers per provider request: drop the unique index
-- on facturas.numero_factura. Search/list flows already use in-memory filtering.
DROP INDEX IF EXISTS "facturas_numero_factura_key";
