# PostgreSQL de TuEventoFun: imagen oficial con configuración y roles horneados.
# Los scripts de initdb solo se ejecutan con el volumen vacío (primer arranque).
FROM postgres:18.6-alpine3.24

# El entrypoint baja de root a postgres con gosu, un binario de Go 1.24 con CVE abiertos en
# la imagen oficial. su-exec (C, de Alpine) hace lo mismo con los mismos argumentos; gosu
# se borra (no basta con sobrescribirlo: Trivy seguiría viéndolo en la capa de abajo).
# Renueva los parches de Alpine cada día sin invalidar la compilación.
ARG SECURITY_REFRESH=manual
RUN apk upgrade --no-cache && apk add --no-cache su-exec \
 && rm /usr/local/bin/gosu \
 && sed -i 's/exec gosu postgres /exec su-exec postgres /' /usr/local/bin/docker-entrypoint.sh \
 && grep -q 'exec su-exec postgres ' /usr/local/bin/docker-entrypoint.sh \
 && ! grep -q 'gosu ' /usr/local/bin/docker-entrypoint.sh

COPY services/postgres/postgresql.conf /etc/postgresql/postgresql.conf
# SQL del rol de solo lectura del panel (lo aplica 01-admin-role.sh; no va en initdb/ porque
# el entrypoint ejecutaría los .sql sin variables)
COPY services/postgres/sql/admin-role.sql /etc/postgresql/admin-role.sql
# Extensiones y rol de la búsqueda de proveedores (lo aplica 02-search.sh)
COPY services/postgres/sql/search-bootstrap.sql /etc/postgresql/search-bootstrap.sql
COPY --chmod=755 services/postgres/initdb/ /docker-entrypoint-initdb.d/

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
