SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE site_palette_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  palette text NOT NULL DEFAULT 'terracotta'
    CHECK (palette IN ('terracotta', 'fuchsia-plum-amber', 'plum-champagne', 'mandarin-raspberry', 'raspberry-vanilla')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO site_palette_settings(singleton, palette) VALUES (true, 'terracotta');
