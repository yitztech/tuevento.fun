-- Idioma de la cuenta: el del dominio donde se registró (tuevento.fun = es, yourevent.fun = en).
-- Queda listo para enviar correos en ese idioma y desde el dominio de ese idioma.
ALTER TABLE users ADD COLUMN locale text NOT NULL DEFAULT 'es' CHECK (locale IN ('es','en'));
