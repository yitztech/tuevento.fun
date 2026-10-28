-- Tokens de autorización para Model Context Protocol (MCP) (docs/PLAN-MCP.md):
-- Aislamiento por actor (organizer, provider, guest) y expiración/revocación.
-- Solo se guarda el hash del token. Tabla nueva y vacía.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) <= 128),
  actor_type text NOT NULL CHECK (actor_type IN ('organizer', 'provider', 'guest')),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  client_name text NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 100),
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT mcp_tokens_actor_check CHECK (
    (actor_type IN ('organizer', 'provider') AND user_id IS NOT NULL AND invitation_id IS NULL) OR
    (actor_type = 'guest' AND invitation_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS mcp_tokens_user_id_idx ON mcp_tokens(user_id);
CREATE INDEX IF NOT EXISTS mcp_tokens_invitation_id_idx ON mcp_tokens(invitation_id);
CREATE INDEX IF NOT EXISTS mcp_tokens_token_hash_idx ON mcp_tokens(token_hash);
