-- Landing de cada evento en <sitio>/<código de la cuenta>/<dirección del evento>.
-- El formato del código coincide con publicCodePattern (packages/contracts/src/index.ts).
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Código público de la cuenta: 8 caracteres aleatorios, sin datos personales ni el UUID interno.
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_code text;
UPDATE users SET public_code = substr(md5(random()::text || id::text), 1, 8) WHERE public_code IS NULL;
ALTER TABLE users ALTER COLUMN public_code SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
-- NOT VALID: se exige en toda escritura nueva; la 016 la valida
ALTER TABLE users ADD CONSTRAINT users_public_code_format CHECK (public_code IS NOT NULL AND public_code ~ '^[a-z0-9]{8}$') NOT VALID;
CREATE UNIQUE INDEX IF NOT EXISTS users_public_code_key ON users(public_code);

-- La dirección ya no es única en todo el servicio, sino dentro de cada cuenta: la URL lleva el
-- código. Va antes del relleno, que puede dar la misma dirección a eventos de cuentas distintas.
CREATE UNIQUE INDEX IF NOT EXISTS events_user_slug_key ON events(user_id, slug);
DROP INDEX IF EXISTS events_slug_key;
CREATE INDEX IF NOT EXISTS events_slug_idx ON events(slug);

-- Todo evento tiene dirección: los que no la tenían la reciben a partir de su título
-- (el mismo criterio que slugify en packages/contracts y freeSlug en apps/api/src/events.ts),
-- con un sufijo si ya la usa otro evento de la misma cuenta.
WITH limpias AS (
  SELECT id, user_id, created_at,
    regexp_replace(left(regexp_replace(regexp_replace(
      translate(lower(title), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'), 50), '-+$', '') AS limpia
  FROM events WHERE slug IS NULL
), candidatos AS (
  SELECT id, user_id, base, row_number() OVER (PARTITION BY user_id, base ORDER BY created_at, id) AS n
  FROM (
    SELECT id, user_id, created_at, CASE
        WHEN limpia = '' THEN 'evento'
        WHEN char_length(limpia) < 3 THEN 'evento-' || limpia
        ELSE limpia
      END AS base
    FROM limpias
  ) s
)
UPDATE events e SET slug = CASE
    WHEN c.n = 1 AND NOT EXISTS (SELECT 1 FROM events o WHERE o.user_id = c.user_id AND o.slug = c.base)
    THEN c.base
    ELSE c.base || '-' || substr(md5(c.id::text), 1, 6)
  END
FROM candidatos c WHERE e.id = c.id;
ALTER TABLE events ADD CONSTRAINT events_slug_present CHECK (slug IS NOT NULL) NOT VALID;

-- Acceso de un invitado a la landing: nace de su enlace personal y se borra con su invitación.
-- Sin invitación, es el acceso por la contraseña del evento.
ALTER TABLE event_access ADD COLUMN IF NOT EXISTS invitation_id uuid;
ALTER TABLE event_access ADD CONSTRAINT event_access_invitation_id_fkey
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE NOT VALID;
CREATE INDEX IF NOT EXISTS event_access_invitation_idx ON event_access(invitation_id);
