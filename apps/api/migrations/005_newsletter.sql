CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  locale text NOT NULL DEFAULT 'es',
  created_at timestamptz NOT NULL DEFAULT now()
);
