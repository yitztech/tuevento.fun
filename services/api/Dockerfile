# syntax=docker/dockerfile:1
# Imagen de `api`. Se construye desde la raíz del repositorio:
#   docker build -f services/api/Dockerfile --build-arg RELEASE_SHA=<sha> .
FROM node:24.22.0-alpine3.24 AS base
WORKDIR /app

# Desarrollo local (compose.yml): tsx watch con recarga en caliente; Compose Watch sincroniza src.
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps/api apps/api
RUN npm run build -w @tuevento/contracts && npm run build -w @tuevento/client
EXPOSE 3087
WORKDIR /app/apps/api
CMD ["npm", "run", "dev"]

FROM base AS build
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --no-audit --no-fund
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @tuevento/contracts && npm run build -w @tuevento/api

# Dependencias de ejecución de la API, sin las de desarrollo ni las de la web
FROM base AS api-deps
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --omit=dev --workspace @tuevento/api --no-audit --no-fund

FROM node:24.22.0-alpine3.24 AS production
# Valores públicos de los App Links (/.well-known/*). No son secretos ni variables de la
# plataforma: el workflow de despliegue los pasa como build-args desde las vars del repo.
ARG ANDROID_CERT_SHA256=
ARG APPLE_TEAM_ID=
ARG MOBILE_APP_ID=com.tueventofun.app
ENV NODE_ENV=production \
    ANDROID_CERT_SHA256=${ANDROID_CERT_SHA256} \
    APPLE_TEAM_ID=${APPLE_TEAM_ID} \
    MOBILE_APP_ID=${MOBILE_APP_ID}
# Sin npm, npx ni corepack en ejecución: no se usan y traen sus propias dependencias (Trivy)
# Renueva los parches de Alpine cada día sin invalidar la compilación.
ARG SECURITY_REFRESH=manual
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && apk upgrade --no-cache
WORKDIR /app
COPY --from=api-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/migrations ./apps/api/migrations
# Fotos de las postales y de los proveedores: carpetas del usuario node (el volumen hereda sus permisos)
ENV POSTCARD_IMAGE_DIR=/data/postcards PROVIDER_IMAGE_DIR=/data/providers
RUN mkdir -p /data/postcards /data/providers && chown node:node /data/postcards /data/providers
USER node
EXPOSE 3087
CMD ["node", "apps/api/dist/main.js"]
