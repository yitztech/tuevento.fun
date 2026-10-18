#!/bin/sh
# Rol de solo lectura del panel de administración. Solo se ejecuta con el volumen vacío;
# en un volumen existente se aplica a mano con services/postgres/sql/admin-role.sql.
set -eu
: "${POSTGRES_USER:?Define POSTGRES_USER}"
: "${POSTGRES_DB:?Define POSTGRES_DB}"
: "${ADMIN_DB_PASSWORD:?Define ADMIN_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -v admin_pw="$ADMIN_DB_PASSWORD" -v db="$POSTGRES_DB" \
     -f /etc/postgresql/admin-role.sql
