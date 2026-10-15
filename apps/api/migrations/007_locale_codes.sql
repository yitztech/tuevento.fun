-- Los idiomas admitidos los define la tabla `locales` de packages/contracts, no la base de
-- datos: añadir un idioma no debe exigir una migración. Se quita la lista fija ('es','en')
-- y se exige solo un código de idioma con forma válida; la API escribe únicamente idiomas
-- admitidos y lee cualquier otro como el principal.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_locale_check;
ALTER TABLE users ADD CONSTRAINT users_locale_check CHECK (locale ~ '^[a-z]{2,3}$');
ALTER TABLE password_resets DROP CONSTRAINT IF EXISTS password_resets_locale_check;
ALTER TABLE password_resets ADD CONSTRAINT password_resets_locale_check CHECK (locale ~ '^[a-z]{2,3}$');
