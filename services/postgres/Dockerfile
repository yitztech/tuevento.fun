# PostgreSQL de TuEventoFun: imagen oficial con configuración y roles horneados.
# Los scripts de initdb solo se ejecutan con el volumen vacío (primer arranque).
FROM postgres:18.6-alpine3.24

COPY services/postgres/postgresql.conf /etc/postgresql/postgresql.conf
# SQL del rol de solo lectura del panel (lo aplica 01-admin-role.sh; no va en initdb/ porque
# el entrypoint ejecutaría los .sql sin variables)
COPY services/postgres/sql/admin-role.sql /etc/postgresql/admin-role.sql
COPY --chmod=755 services/postgres/initdb/ /docker-entrypoint-initdb.d/

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
