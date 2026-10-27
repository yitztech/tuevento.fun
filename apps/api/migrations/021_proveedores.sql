-- Perfil, categorías, servicios y fotos de quien ofrece servicios para eventos
-- (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 3). Tablas nuevas y vacías: sus restricciones nacen
-- válidas. Las longitudes van en ALTER TABLE … ADD CONSTRAINT para que limits.test.ts las compare
-- con accountLimits.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS provider_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) >= 3),
  business_name text NOT NULL,
  headline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  -- Teléfonos en E.164, como el de la cuenta
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  public_email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  facebook_url text NOT NULL DEFAULT '',
  tiktok_url text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'MX' CHECK (country ~ '^[A-Z]{2}$'),
  latitude double precision,
  longitude double precision,
  address_visibility text NOT NULL DEFAULT 'approximate' CHECK (address_visibility IN ('exact', 'approximate')),
  service_radius_km bigint NOT NULL DEFAULT 25 CHECK (service_radius_km BETWEEN 0 AND 500),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
  published_at timestamptz,
  cover_image_id uuid,
  logo_image_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Las dos coordenadas o ninguna, dentro de su rango (igual que events_geo_range)
  CONSTRAINT provider_profiles_geo_range CHECK (
    (latitude IS NULL) = (longitude IS NULL)
    AND (latitude IS NULL OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
  )
);

-- Mismos códigos que providerCategories en packages/contracts (un test los compara)
CREATE TABLE IF NOT EXISTS provider_categories (
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'venue', 'planner', 'wedding-planner', 'furniture-rental', 'catering', 'bakery', 'dj',
    'live-music', 'photo-video', 'decoration', 'lighting-sound', 'entertainment', 'bar',
    'beauty', 'attire', 'transport', 'other'
  )),
  PRIMARY KEY (provider_id, category)
);

CREATE TABLE IF NOT EXISTS provider_services (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  -- Dinero como entero en centavos, con su moneda ISO 4217 (AGENTS.md §21)
  price_from_cents bigint CHECK (price_from_cents >= 0),
  currency text CHECK (currency ~ '^[A-Z]{3}$'),
  price_unit text CHECK (price_unit IN ('event', 'hour', 'person', 'item', 'day')),
  position bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Precio, moneda y unidad van juntos: los tres o ninguno
  CONSTRAINT provider_services_price CHECK (
    (price_from_cents IS NULL) = (currency IS NULL) AND (price_from_cents IS NULL) = (price_unit IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS provider_images (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES provider_services(id) ON DELETE SET NULL,
  alt text NOT NULL DEFAULT '',
  width bigint NOT NULL CHECK (width > 0),
  height bigint NOT NULL CHECK (height > 0),
  position bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_cover_fk FOREIGN KEY (cover_image_id) REFERENCES provider_images(id) ON DELETE SET NULL,
  ADD CONSTRAINT provider_profiles_logo_fk FOREIGN KEY (logo_image_id) REFERENCES provider_images(id) ON DELETE SET NULL;

-- Direcciones anteriores de un perfil publicado (responderán 301) y las de perfiles borrados (410)
CREATE TABLE IF NOT EXISTS provider_slug_history (
  slug text PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS provider_deleted_slugs (
  slug text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_services_provider_idx ON provider_services(provider_id, position);
CREATE INDEX IF NOT EXISTS provider_images_provider_idx ON provider_images(provider_id, position);
CREATE INDEX IF NOT EXISTS provider_images_service_idx ON provider_images(service_id);
CREATE INDEX IF NOT EXISTS provider_slug_history_provider_idx ON provider_slug_history(provider_id);

-- Longitudes: las mismas que accountLimits (limits.test.ts)
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_slug_max_length CHECK (char_length(slug) <= 60);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_business_name_max_length CHECK (char_length(business_name) <= 150);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_headline_max_length CHECK (char_length(headline) <= 150);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_description_max_length CHECK (char_length(description) <= 5000);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_phone_max_length CHECK (char_length(phone) <= 20);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_whatsapp_max_length CHECK (char_length(whatsapp) <= 20);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_public_email_max_length CHECK (char_length(public_email) <= 254);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_website_max_length CHECK (char_length(website) <= 2048);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_instagram_url_max_length CHECK (char_length(instagram_url) <= 2048);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_facebook_url_max_length CHECK (char_length(facebook_url) <= 2048);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_tiktok_url_max_length CHECK (char_length(tiktok_url) <= 2048);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_address_max_length CHECK (char_length(address) <= 200);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_city_max_length CHECK (char_length(city) <= 200);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_region_max_length CHECK (char_length(region) <= 200);
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_postal_code_max_length CHECK (char_length(postal_code) <= 10);
ALTER TABLE provider_services ADD CONSTRAINT provider_services_title_max_length CHECK (char_length(title) <= 150);
ALTER TABLE provider_services ADD CONSTRAINT provider_services_description_max_length CHECK (char_length(description) <= 2000);
ALTER TABLE provider_images ADD CONSTRAINT provider_images_alt_max_length CHECK (char_length(alt) <= 255);

-- updated_at al día en cada cambio, lo haga la API o no
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER provider_profiles_updated_at BEFORE UPDATE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER provider_services_updated_at BEFORE UPDATE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Un perfil borrado (con su cuenta) deja sus direcciones, la actual y las anteriores, como
-- borradas: responden 410 y nadie más las puede usar
CREATE OR REPLACE FUNCTION provider_profiles_keep_deleted_slugs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO provider_deleted_slugs(slug) VALUES (OLD.slug) ON CONFLICT DO NOTHING;
  INSERT INTO provider_deleted_slugs(slug)
    SELECT slug FROM provider_slug_history WHERE provider_id = OLD.id
    ON CONFLICT DO NOTHING;
  RETURN OLD;
END $$;
CREATE TRIGGER provider_profiles_deleted_slugs BEFORE DELETE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION provider_profiles_keep_deleted_slugs();
