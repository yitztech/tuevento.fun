# syntax=docker/dockerfile:1
# Imagen de `web`: el frontend (SPA de React). Detrás del gateway, que le pasa el Host
# original: aquí se decide el idioma y se insertan canonical, hreflang, robots, sitemap,
# cabeceras de seguridad y analítica. Se construye desde la raíz del repositorio:
#   docker build -f services/web/Dockerfile --build-arg RELEASE_SHA=<sha> .
FROM node:24.22.0-alpine3.24 AS base
WORKDIR /app

# Desarrollo local (compose.yml): Vite con recarga en caliente detrás de un Nginx que
# aplica el mismo idioma por dominio que producción. Escucha en 8080, como producción.
FROM base AS dev
RUN apk add --no-cache nginx gettext
COPY package*.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps/web apps/web
RUN npm run build -w @tuevento/contracts && npm run build -w @tuevento/client
# Idiomas y rutas traducidas de packages/contracts para 17-sites.sh
COPY services/web/locales-manifest.cjs services/web/
RUN node services/web/locales-manifest.cjs packages/contracts/dist > /etc/nginx/locales.txt
COPY services/web/default.dev.conf.template /etc/nginx/templates/default.dev.conf.template
# Las cabeceras de seguridad de producción, con dos cambios para Vite: scripts en línea
# (el preámbulo de React Refresh) y sin la analítica, que en desarrollo no se carga
COPY services/web/snippets/security-headers.conf /tmp/security-headers.conf
RUN mkdir -p /etc/nginx/snippets \
 && sed -e "s/script-src 'self'/script-src 'self' 'unsafe-inline'/" -e 's/\$analytics_src//g' -e 's/\$errores_src//g' \
      /tmp/security-headers.conf > /etc/nginx/snippets/security-headers.conf \
 && rm /tmp/security-headers.conf
COPY --chmod=755 services/web/17-sites.sh /17-sites.sh
COPY --chmod=755 services/web/dev-entrypoint.sh /dev-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/dev-entrypoint.sh"]

# Compilación de la SPA para producción
FROM base AS build
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --no-audit --no-fund
COPY packages/contracts packages/contracts
COPY packages/client packages/client
COPY packages/app packages/app
COPY apps/web apps/web
COPY services/web/locales-manifest.cjs services/web/
# Registro de errores (AUDITORIA INT-07): DSN pública de la variable SENTRY_DSN; vacía = apagado
ARG SENTRY_DSN=""
ARG RELEASE_SHA=dev
ENV VITE_SENTRY_DSN=$SENTRY_DSN VITE_RELEASE_SHA=$RELEASE_SHA
RUN npm run build -w @tuevento/contracts && npm run build -w @tuevento/client && npm run build -w @tuevento/web \
 && node services/web/locales-manifest.cjs packages/contracts/dist > /app/locales.txt

# Producción: Nginx 1.30.5 Alpine sirviendo la SPA estática en el puerto 8080
FROM nginx:1.30.6-alpine AS production
# Paquetes de Alpine con los arreglos publicados después de la imagen base (Trivy)
# Renueva los parches de Alpine cada día sin invalidar la compilación.
ARG SECURITY_REFRESH=manual
RUN apk upgrade --no-cache
ARG RELEASE_SHA=dev
ENV RELEASE_SHA=${RELEASE_SHA} \
    NGINX_ENVSUBST_FILTER='^RELEASE_SHA$'
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/locales.txt /etc/nginx/locales.txt
COPY services/web/snippets/ /etc/nginx/snippets/
COPY services/web/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 services/web/16-analytics.sh /docker-entrypoint.d/16-analytics.sh
COPY --chmod=755 services/web/17-sites.sh /docker-entrypoint.d/17-sites.sh
EXPOSE 8080
