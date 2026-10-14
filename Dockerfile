# Imágenes de producción (y de desarrollo con compose.yml). Se construyen desde la raíz:
#   docker build --target api -t t-api .
#   docker build --target gateway --build-arg RELEASE_SHA=<sha> -t t-gateway .
# La configuración va dentro de las imágenes: el servidor solo descarga y arranca.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --no-audit --no-fund
COPY apps apps
COPY packages packages
RUN npm run build

# Dependencias de ejecución de la API, sin las de desarrollo ni las de la web
FROM node:24-bookworm-slim AS api-deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --omit=dev --workspace @tuevento/api --no-audit --no-fund

FROM node:24-bookworm-slim AS api
# Valores públicos de los App Links (/.well-known/*). No son secretos ni variables de la
# plataforma: el workflow de despliegue los pasa como build-args desde las vars del repo.
ARG ANDROID_CERT_SHA256=
ARG APPLE_TEAM_ID=
ARG MOBILE_APP_ID=com.tueventofun.app
ENV NODE_ENV=production \
    ANDROID_CERT_SHA256=${ANDROID_CERT_SHA256} \
    APPLE_TEAM_ID=${APPLE_TEAM_ID} \
    MOBILE_APP_ID=${MOBILE_APP_ID}
WORKDIR /app
COPY --from=api-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/migrations ./apps/api/migrations
USER node
EXPOSE 3087
CMD ["node", "apps/api/dist/main.js"]

FROM nginx:1.30-alpine AS gateway
ARG RELEASE_SHA=dev
ENV RELEASE_SHA=${RELEASE_SHA} \
    # El entrypoint de nginx solo sustituye estas variables en la plantilla
    NGINX_ENVSUBST_FILTER='^(TRUSTED_PROXY_CIDR|RELEASE_SHA)$'
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY gateway/snippets/ /etc/nginx/snippets/
COPY gateway/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 gateway/16-analytics.sh /docker-entrypoint.d/16-analytics.sh
COPY --chmod=755 gateway/17-sites.sh /docker-entrypoint.d/17-sites.sh
EXPOSE 80
