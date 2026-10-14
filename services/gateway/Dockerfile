# syntax=docker/dockerfile:1
# Imagen de `gateway`. Se construye desde la raíz del repositorio:
#   docker build -f services/gateway/Dockerfile --build-arg RELEASE_SHA=<sha> .
FROM node:24.21.0-alpine3.24 AS base
WORKDIR /app

# Desarrollo local (compose.yml): Nginx reverse proxy con Vite dev server y HMR
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
COPY services/gateway/snippets/ /etc/nginx/snippets/
COPY services/gateway/default.dev.conf.template /etc/nginx/templates/default.dev.conf.template
COPY --chmod=755 services/gateway/17-sites.sh /17-sites.sh
COPY --chmod=755 services/gateway/dev-entrypoint.sh /dev-entrypoint.sh
EXPOSE 80 5187
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
COPY packages packages
COPY apps apps
RUN npm run build

# Producción: Nginx 1.30.5 Alpine sirviendo la SPA estática y repartiendo /api/
FROM nginx:1.30.5-alpine AS production
ARG RELEASE_SHA=dev
ENV RELEASE_SHA=${RELEASE_SHA} \
    NGINX_ENVSUBST_FILTER='^(TRUSTED_PROXY_CIDR|RELEASE_SHA)$'
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY services/gateway/snippets/ /etc/nginx/snippets/
COPY services/gateway/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 services/gateway/16-analytics.sh /docker-entrypoint.d/16-analytics.sh
COPY --chmod=755 services/gateway/17-sites.sh /docker-entrypoint.d/17-sites.sh
EXPOSE 80
