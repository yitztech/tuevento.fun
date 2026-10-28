-- Dispositivos de confianza (OWASP, «device cookies»): el navegador desde el que alguien ya entró
-- bien sigue pudiendo entrar aunque su cuenta esté frenada por intentos ajenos. Solo se guarda el
-- hash del token. Tabla nueva y vacía.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS trusted_devices (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS trusted_devices_user_id_idx ON trusted_devices(user_id);
