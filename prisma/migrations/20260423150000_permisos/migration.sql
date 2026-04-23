-- Permiso catalog + rol→permiso join. Rows are seeded idempotently from
-- lib/permisos/catalog.ts at migration/seed time; this file only creates the
-- structure.

CREATE TABLE "permisos" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");
CREATE INDEX "permisos_modulo_idx" ON "permisos"("modulo");

CREATE TABLE "rol_permisos" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id", "permiso_id")
);

CREATE INDEX "rol_permisos_rol_id_idx" ON "rol_permisos"("rol_id");

ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey"
    FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey"
    FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
