-- Recuperación de contraseña: enlaces de un solo uso que caducan en una hora.
-- Solo se guarda el hash del token. `locale` es el idioma del dominio desde el que se
-- pidió el enlace: el correo sale en ese idioma, desde ese dominio, y el enlace vuelve a él.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('es','en')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
