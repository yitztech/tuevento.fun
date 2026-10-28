-- Búsqueda de proveedores: extensiones (las crea el superusuario; el rol `api`, que aplica las
-- migraciones, no puede) y el rol de solo lectura del servicio `search`.
-- Uso, como el dueño (tuevento), una vez antes de desplegar la fase 5:
--   psql -v ON_ERROR_STOP=1 -v search_pw='…' -v db=tueventofun -f search-bootstrap.sql
-- \gset guarda el resultado de set_config en una variable de psql en vez de mostrarlo: la contraseña
-- nunca sale en la terminal.
-- Es seguro repetirlo: crea lo que falte y solo cambia la contraseña del rol si ya existe.
-- psql no sustituye variables dentro de $$…$$: la contraseña pasa al bloque por una opción de la sesión.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
SELECT set_config('search.pw', :'search_pw', false) \gset
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'search_ro') THEN
    CREATE ROLE search_ro;
  END IF;
  EXECUTE format('ALTER ROLE search_ro WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', current_setting('search.pw'));
END
$$;
SELECT set_config('search.pw', '', false) \gset
GRANT CONNECT ON DATABASE :"db" TO search_ro;
GRANT USAGE ON SCHEMA public TO search_ro;
-- Nada más que la tabla de búsqueda: si ya existe (volumen con la migración 022), su permiso
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM search_ro;
DO $$
BEGIN
  IF to_regclass('public.provider_search') IS NOT NULL THEN
    GRANT SELECT ON provider_search TO search_ro;
  END IF;
END
$$;
