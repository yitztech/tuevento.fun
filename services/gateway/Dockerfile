# syntax=docker/dockerfile:1
# Imagen de `gateway`: único punto de entrada. Reparte /api y /.well-known a `api` y
# todo lo demás a `web`; resuelve la IP real del cliente. No contiene la web, así que
# es la misma imagen en desarrollo y en producción. Se construye desde la raíz:
#   docker build -f services/gateway/Dockerfile .
FROM nginx:1.30.5-alpine
ENV NGINX_ENVSUBST_FILTER='^TRUSTED_PROXY_CIDR$'
COPY services/gateway/snippets/ /etc/nginx/snippets/
COPY services/gateway/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
