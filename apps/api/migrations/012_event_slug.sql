-- Dirección pública del evento (/e/<slug>): opcional, única en todo el servicio.
-- Formato y longitud deben coincidir con eventSchema y accountLimits.eventSlug
-- (packages/contracts/src/index.ts); packages/contracts/src/limits.test.ts lo comprueba.
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE events ADD CONSTRAINT events_slug_max_length CHECK (char_length(slug) <= 60);
ALTER TABLE events ADD CONSTRAINT events_slug_format CHECK (slug IS NULL OR (char_length(slug) >= 3 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON events(slug) WHERE slug IS NOT NULL;
