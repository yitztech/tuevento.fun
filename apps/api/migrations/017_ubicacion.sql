-- Punto exacto del lugar de cada evento (geoPointSchema en packages/contracts) y caché de las
-- búsquedas en el mapa (Nominatim pide no repetir consultas: apps/api/src/geo.ts).
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude double precision;
-- Las dos coordenadas o ninguna, dentro de su rango. NOT VALID: la 018 la valida
-- (con una sola NULL, un OR daría NULL y el CHECK lo aceptaría: por eso la igualdad primero)
ALTER TABLE events ADD CONSTRAINT events_geo_range CHECK (
  (latitude IS NULL) = (longitude IS NULL)
  AND (latitude IS NULL OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
) NOT VALID;

CREATE TABLE IF NOT EXISTS geo_cache (
  kind text NOT NULL CHECK (kind IN ('search', 'reverse')),
  key_hash text NOT NULL,
  locale text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key_hash, locale)
);
CREATE INDEX IF NOT EXISTS geo_cache_created_idx ON geo_cache(created_at);
