-- Postal editable por evento: un diseño actual, versiones guardadas y las fotos que usa.
-- El diseño es JSON validado en la API (packages/contracts); aquí solo se acota su tamaño.
CREATE TABLE IF NOT EXISTS postcards (
  event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT postcards_design_size CHECK (pg_column_size(design) <= 16384)
);
CREATE TABLE IF NOT EXISTS postcard_versions (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  design jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT postcard_versions_design_size CHECK (pg_column_size(design) <= 16384)
);
CREATE INDEX IF NOT EXISTS postcard_versions_event_idx ON postcard_versions(event_id, created_at DESC);
CREATE TABLE IF NOT EXISTS postcard_images (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS postcard_images_event_idx ON postcard_images(event_id);
