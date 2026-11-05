-- Servidor OAuth para clientes MCP (docs/PLAN-MCP.md): códigos, tokens, autorizaciones y pasos del
-- consentimiento. Solo se guarda el HMAC de cada identificador, nunca el token. Tabla nueva y vacía.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS mcp_oauth_records (
  record_hash text PRIMARY KEY CHECK (char_length(record_hash) <= 128),
  model text NOT NULL CHECK (char_length(model) <= 50),
  grant_hash text CHECK (char_length(grant_hash) <= 128),
  uid_hash text CHECK (char_length(uid_hash) <= 128),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_records_grant_hash_idx ON mcp_oauth_records(grant_hash);
CREATE INDEX IF NOT EXISTS mcp_oauth_records_uid_hash_idx ON mcp_oauth_records(uid_hash);
CREATE INDEX IF NOT EXISTS mcp_oauth_records_user_id_idx ON mcp_oauth_records(user_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_records_expires_at_idx ON mcp_oauth_records(expires_at);
