-- One-time invite/reset tokens for Usuario onboarding.
-- Admin generates, user follows /invitacion/<token> to set their own password.
-- No SMTP — distribution is out of band.

CREATE TABLE "usuario_invite_tokens" (
  "token"       TEXT         NOT NULL,
  "usuario_id"  INTEGER      NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"  TIMESTAMP(3) NOT NULL,
  "used_at"     TIMESTAMP(3),
  "created_by"  INTEGER,

  CONSTRAINT "usuario_invite_tokens_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "usuario_invite_tokens_usuario_id_used_at_idx"
  ON "usuario_invite_tokens"("usuario_id", "used_at");

ALTER TABLE "usuario_invite_tokens"
  ADD CONSTRAINT "usuario_invite_tokens_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuario_invite_tokens"
  ADD CONSTRAINT "usuario_invite_tokens_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
