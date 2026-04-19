-- QA-037: allow recepciones to terminate without a factura.
-- Legacy "Completar remitos sin factura" path for supplier returns, free
-- replacements, damaged-goods remitos that never get invoiced. Without a
-- terminal state these recepciones stay in the unfacturated-lines query
-- forever. The four columns capture who/when/why.
ALTER TABLE "recepciones"
  ADD COLUMN "cerrada_sin_factura" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivo_cierre" TEXT,
  ADD COLUMN "fecha_cierre" TIMESTAMP(3),
  ADD COLUMN "cerrado_por" TEXT;
