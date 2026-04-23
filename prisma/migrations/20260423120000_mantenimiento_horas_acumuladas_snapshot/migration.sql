-- Snapshot of maquinaria.horas_acumuladas at the moment a mantenimiento is
-- created. Enables hour-based MTBF in the estadísticas/maquinaria dashboard.
-- Nullable: legacy rows imported from flota7.db have no snapshot (date-based
-- MTBF remains the fallback when a consecutive pair of correctivos is missing
-- snapshots on either end).
ALTER TABLE "mantenimientos" ADD COLUMN "horas_acumuladas_snapshot" DOUBLE PRECISION;
