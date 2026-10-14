#!/bin/sh
# Roles y permisos por servicio. Solo se ejecuta con el volumen vacío.
set -eu
: "${POSTGRES_USER:?Define POSTGRES_USER}"
: "${POSTGRES_DB:?Define POSTGRES_DB}"
: "${API_DB_PASSWORD:?Define API_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -v api_pw="$API_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
DROP ROLE IF EXISTS api;
CREATE ROLE api LOGIN PASSWORD :'api_pw';

GRANT CONNECT ON DATABASE :"db" TO api;
GRANT USAGE, CREATE ON SCHEMA public TO api;
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO api';
  END LOOP;
  FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO api';
  END LOOP;
END
$$;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO api;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO api;
SQL
