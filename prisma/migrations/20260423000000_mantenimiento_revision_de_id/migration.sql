-- Self-referencing FK so a scheduled-revision child mantenimiento points back
-- to the parent it was spawned from. Null for correctivos, manuales, or legacy
-- rows (no legacy mantenimientos used the revision flow per Phase 6 probe).
ALTER TABLE "mantenimientos" ADD COLUMN "revision_de_id" INTEGER;

ALTER TABLE "mantenimientos"
  ADD CONSTRAINT "mantenimientos_revision_de_id_fkey"
  FOREIGN KEY ("revision_de_id") REFERENCES "mantenimientos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "mantenimientos_revision_de_id_idx" ON "mantenimientos"("revision_de_id");
