#!/bin/sh
# Rol de solo lectura del panel de administración. Solo se ejecuta con el volumen vacío.
# Aquí solo se crea el rol: los permisos sobre las tablas los da la migración 014, porque
# las tablas no existen todavía cuando corre este script. En un volumen existente, el rol y
# sus permisos se aplican a mano con services/postgres/sql/admin-role.sql.
set -eu
: "${POSTGRES_USER:?Define POSTGRES_USER}"
: "${POSTGRES_DB:?Define POSTGRES_DB}"
: "${ADMIN_DB_PASSWORD:?Define ADMIN_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -v admin_pw="$ADMIN_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE admin_ro LOGIN PASSWORD :'admin_pw';
GRANT CONNECT ON DATABASE :"db" TO admin_ro;
GRANT USAGE ON SCHEMA public TO admin_ro;
SQL
