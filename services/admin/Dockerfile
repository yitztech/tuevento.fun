# syntax=docker/dockerfile:1
# Imagen de `admin`: panel de administración (solo para el administrador del sitio).
# Servidor Node sin framework + interfaz en Angular, compilada aquí y servida como archivos estáticos.
# Se construye desde la raíz:
#   docker build -f services/admin/Dockerfile .
FROM node:24.22.0-alpine3.24 AS manifests
WORKDIR /app
COPY package*.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/

# Compila la interfaz (Angular y TypeScript solo hacen falta aquí, no en ejecución)
FROM manifests AS build
RUN npm ci --workspace @tuevento/admin --no-audit --no-fund
COPY apps/admin/angular.json apps/admin/tsconfig.json apps/admin/tsconfig.app.json apps/admin/
COPY apps/admin/src/web apps/admin/src/web
RUN NG_CLI_ANALYTICS=false npm run build -w @tuevento/admin

FROM manifests AS deps
RUN npm ci --omit=dev --workspace @tuevento/admin --no-audit --no-fund

FROM node:24.22.0-alpine3.24 AS production
ENV NODE_ENV=production
# Sin npm, npx ni corepack en ejecución: no se usan y traen sus propias dependencias (Trivy)
# Renueva los parches de Alpine cada día sin invalidar la compilación.
ARG SECURITY_REFRESH=manual
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && apk upgrade --no-cache
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node apps/admin/package.json apps/admin/
COPY --chown=node:node apps/admin/src/*.mjs apps/admin/src/
COPY --from=build --chown=node:node /app/apps/admin/dist/browser apps/admin/dist/browser
USER node
EXPOSE 3088
CMD ["node", "apps/admin/src/server.mjs"]
