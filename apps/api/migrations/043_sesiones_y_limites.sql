-- Seguridad del acceso (AGENTS.md §24 y §26):
-- 1. Las sesiones caducan también por inactividad: `last_seen_at` guarda el último uso. Las que ya
--    existen cuentan desde ahora.
-- 2. Los límites de intentos del acceso pasan de la memoria del proceso a PostgreSQL: sobreviven a
--    un reinicio y los comparten todos los procesos. `key` es el SHA-256 de la clave lógica: ni
--    correos ni IP en claro.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- now() no es volátil: PostgreSQL no reescribe la tabla
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  count bigint NOT NULL CHECK (count > 0),
  reset_at timestamptz NOT NULL,
  next_at timestamptz
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_at_idx ON rate_limits(reset_at);
