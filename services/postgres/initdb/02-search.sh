#!/bin/sh
# Búsqueda de proveedores (servicio `search`): extensiones y rol de solo lectura. Solo se ejecuta
# con el volumen vacío; en uno existente se aplica a mano services/postgres/sql/search-bootstrap.sql.
# El permiso sobre la tabla provider_search lo da la migración 022, que es la que la crea.
set -eu
: "${POSTGRES_USER:?Define POSTGRES_USER}"
: "${POSTGRES_DB:?Define POSTGRES_DB}"
: "${SEARCH_DB_PASSWORD:?Define SEARCH_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -v search_pw="$SEARCH_DB_PASSWORD" -v db="$POSTGRES_DB" \
     -f /etc/postgresql/search-bootstrap.sql
