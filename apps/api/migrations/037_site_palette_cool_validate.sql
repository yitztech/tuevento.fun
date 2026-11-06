SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Valida la restricción que la 036 añadió con NOT VALID.
ALTER TABLE site_palette_settings VALIDATE CONSTRAINT site_palette_settings_palette_check;
