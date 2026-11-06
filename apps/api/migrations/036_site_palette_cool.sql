SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Cuatro paletas frías más. NOT VALID: la 037 valida la fila existente.
ALTER TABLE site_palette_settings
  DROP CONSTRAINT site_palette_settings_palette_check,
  ADD CONSTRAINT site_palette_settings_palette_check CHECK (palette IN (
    'terracotta', 'fuchsia-plum-amber', 'plum-champagne', 'mandarin-raspberry', 'raspberry-vanilla',
    'ocean-aqua', 'forest-mint', 'indigo-ice', 'petrol-lime'
  )) NOT VALID;
