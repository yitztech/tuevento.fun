-- Correos a invitados sin abuso: que nadie use la plataforma para mandar spam con su remitente.
-- - El organizador confirma su correo antes de que la plataforma escriba a sus invitados. Las
--   cuentas que ya existían quedan como confirmadas (la tabla es pequeña: una sola UPDATE).
-- - Cupos diarios por destinatario y por organizador (mail_sends), y bajas (mail_suppressions). Se
--   guarda un HMAC del correo, nunca la dirección.
-- - Los avisos de cambios de un evento se agrupan (event_change_notices) y se cuentan por envío
--   (event_notice_batches).
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL AND is_demo = false;

CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx ON email_verifications(user_id);

CREATE TABLE IF NOT EXISTS mail_suppressions (
  email_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_sends (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  recipient_hash text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('event_changed', 'event_cancelled', 'guest_reply')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_sends_recipient_idx ON mail_sends(recipient_hash, created_at);
CREATE INDEX IF NOT EXISTS mail_sends_owner_idx ON mail_sends(owner_id, created_at);

CREATE TABLE IF NOT EXISTS event_change_notices (
  event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  date_changed boolean NOT NULL DEFAULT false,
  place_changed boolean NOT NULL DEFAULT false,
  due_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS event_notice_batches (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_notice_batches_event_idx ON event_notice_batches(event_id, sent_at);
