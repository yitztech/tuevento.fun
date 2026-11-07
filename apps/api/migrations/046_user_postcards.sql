-- Postales propias, independientes de los eventos existentes.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS user_postcards (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  design jsonb NOT NULL,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_postcards_design_size CHECK (pg_column_size(design) <= 16384)
);
CREATE INDEX IF NOT EXISTS user_postcards_user_idx ON user_postcards(user_id, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS user_postcard_images (
  id uuid PRIMARY KEY,
  postcard_id uuid NOT NULL REFERENCES user_postcards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_postcard_images_postcard_idx ON user_postcard_images(postcard_id);
