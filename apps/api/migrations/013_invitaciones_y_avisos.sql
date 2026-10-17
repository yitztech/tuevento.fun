-- Cancelar un evento, contraseña opcional para su página pública y su bloqueo ante intentos fallidos.
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS public_password_hash text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS public_password_failures integer NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS public_password_locked_until timestamptz;

-- Invitación genérica (kind 'open') y registros que nacen de ella. Si se borra el enlace,
-- sus registros siguen existiendo como invitaciones normales.
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_kind_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_kind_check CHECK (kind IN ('individual', 'family', 'open'));
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES invitations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invitations_parent_idx ON invitations(parent_id);

-- Acceso a la página pública protegida: solo el hash del token, con caducidad.
CREATE TABLE IF NOT EXISTS event_access (
  token_hash text PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
