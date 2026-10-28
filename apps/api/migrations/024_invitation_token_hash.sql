-- Tokens de invitación sin guardar en claro (AGENTS.md §24): un HMAC para buscarlos y una copia
-- cifrada para mostrárselos al organizador (apps/api/src/tokens.ts). Primer paso de la transición
-- (§27): columnas nuevas, opcionales. La API las rellena al arrancar (necesita APP_SECRET) y deja de
-- leer `token`; una migración posterior, en otro despliegue, vacía y borra `token`.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_sealed text;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_hash_key ON invitations(token_hash);
