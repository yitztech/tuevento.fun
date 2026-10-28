-- Búsqueda de proveedores (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 5): una fila por perfil
-- publicado, al día en la misma transacción por triggers, que el servicio `search` (rol search_ro)
-- solo lee. Las extensiones las crea el superusuario con services/postgres/sql/search-bootstrap.sql.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_trgm')
     OR NOT EXISTS (SELECT FROM pg_extension WHERE extname = 'unaccent') THEN
    RAISE EXCEPTION 'Faltan las extensiones pg_trgm y unaccent: ejecuta services/postgres/sql/search-bootstrap.sql como superusuario';
  END IF;
END
$$;

-- unaccent() es STABLE (depende del diccionario); con el diccionario fijo se puede indexar
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE TABLE IF NOT EXISTS provider_search (
  provider_id uuid PRIMARY KEY REFERENCES provider_profiles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  business_name text NOT NULL,
  headline text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  country text NOT NULL,
  categories text[] NOT NULL,
  -- Las públicas: redondeadas a 2 decimales si la dirección es aproximada (como la página)
  latitude double precision,
  longitude double precision,
  service_radius_km bigint NOT NULL,
  price_from_cents bigint,
  currency text,
  cover_image_id uuid,
  name_norm text NOT NULL,
  document tsvector NOT NULL,
  published_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS provider_search_document_idx ON provider_search USING gin (document);
CREATE INDEX IF NOT EXISTS provider_search_name_idx ON provider_search USING gin (name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS provider_search_categories_idx ON provider_search USING gin (categories);
CREATE INDEX IF NOT EXISTS provider_search_point_idx ON provider_search (latitude, longitude);

-- Reescribe la fila de un perfil, o la borra si no está publicado
CREATE OR REPLACE FUNCTION refresh_provider_search(p uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM provider_search WHERE provider_id = p;
  INSERT INTO provider_search
  SELECT pp.id, pp.slug, pp.business_name, pp.headline, pp.city, pp.region, pp.country,
    COALESCE((SELECT array_agg(c.category ORDER BY c.category) FROM provider_categories c WHERE c.provider_id = pp.id), '{}'),
    CASE WHEN pp.address_visibility = 'exact' THEN pp.latitude ELSE round(pp.latitude::numeric, 2)::double precision END,
    CASE WHEN pp.address_visibility = 'exact' THEN pp.longitude ELSE round(pp.longitude::numeric, 2)::double precision END,
    pp.service_radius_km,
    price.price_from_cents, price.currency,
    COALESCE(pp.cover_image_id, (SELECT i.id FROM provider_images i WHERE i.provider_id = pp.id ORDER BY i.position, i.created_at LIMIT 1)),
    lower(f_unaccent(pp.business_name)),
    setweight(to_tsvector('simple', f_unaccent(pp.business_name)), 'A')
      || setweight(to_tsvector('simple', f_unaccent(pp.headline || ' ' || COALESCE((SELECT string_agg(s.title, ' ') FROM provider_services s WHERE s.provider_id = pp.id), ''))), 'B')
      || setweight(to_tsvector('simple', f_unaccent(pp.description || ' ' || pp.city || ' ' || pp.region)), 'C'),
    COALESCE(pp.published_at, pp.updated_at), pp.updated_at
  FROM provider_profiles pp
  LEFT JOIN LATERAL (
    -- El precio «desde» más bajo, en la moneda de ese servicio
    SELECT s.price_from_cents, s.currency FROM provider_services s
     WHERE s.provider_id = pp.id AND s.price_from_cents IS NOT NULL
     ORDER BY s.price_from_cents LIMIT 1
  ) price ON true
  WHERE pp.id = p AND pp.status = 'published';
END $$;

CREATE OR REPLACE FUNCTION provider_search_from_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Al borrar el perfil, la fila se va con ON DELETE CASCADE
  IF TG_OP <> 'DELETE' THEN PERFORM refresh_provider_search(NEW.id); END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION provider_search_from_child() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM refresh_provider_search(OLD.provider_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN
    PERFORM refresh_provider_search(NEW.provider_id);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER provider_search_profiles AFTER INSERT OR UPDATE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION provider_search_from_profile();
CREATE TRIGGER provider_search_categories AFTER INSERT OR UPDATE OR DELETE ON provider_categories
  FOR EACH ROW EXECUTE FUNCTION provider_search_from_child();
CREATE TRIGGER provider_search_services AFTER INSERT OR UPDATE OR DELETE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION provider_search_from_child();
CREATE TRIGGER provider_search_images AFTER INSERT OR UPDATE OR DELETE ON provider_images
  FOR EACH ROW EXECUTE FUNCTION provider_search_from_child();

-- Perfiles que ya estaban publicados antes de esta migración
SELECT refresh_provider_search(id) FROM provider_profiles WHERE status = 'published';

-- search_ro (si existe: lo crea search-bootstrap.sql) solo lee esta tabla
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'search_ro') THEN
    GRANT USAGE ON SCHEMA public TO search_ro;
    GRANT SELECT ON provider_search TO search_ro;
  END IF;
END
$$;
