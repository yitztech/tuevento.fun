# syntax=docker/dockerfile:1
# Imagen de `gateway`: único punto de entrada. Reparte /api y /.well-known a `api` y
# todo lo demás a `web`; resuelve la IP real del cliente. No contiene la web, así que
# es la misma imagen en desarrollo y en producción. Se construye desde la raíz:
#   docker build -f services/gateway/Dockerfile .
FROM nginx:1.30.6-alpine
ENV NGINX_ENVSUBST_FILTER='^(TRUSTED_PROXY_CIDR|ADMIN_HOST)$'
COPY services/gateway/snippets/ /etc/nginx/snippets/
COPY services/gateway/default.conf.template /etc/nginx/templates/default.conf.template
# Sin root (CON-06): nginx corre como 101:101 desde el principio. Escucha en 80 sin
# NET_BIND_SERVICE porque Docker permite puertos bajos a cualquier usuario del contenedor
# (net.ipv4.ip_unprivileged_port_start=0). PID en /tmp; /tmp, /var/cache/nginx y
# /etc/nginx/conf.d son tmpfs en compose.prod.yml (sistema de archivos de solo lectura).
# Paquetes de Alpine con los arreglos publicados después de la imagen base (Trivy)
RUN apk upgrade --no-cache
RUN sed -i -e '/^user /d' -e 's#^pid .*#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf \
 && chown -R 101:101 /var/cache/nginx /etc/nginx/conf.d
USER 101:101
EXPOSE 80
