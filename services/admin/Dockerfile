# syntax=docker/dockerfile:1
# Imagen de `admin`: panel de administración (solo para el administrador del sitio).
# Node sin framework + AngularJS vendorizado desde npm: no necesita nada más. Se construye desde la raíz:
#   docker build -f services/admin/Dockerfile .
FROM node:24.21.0-alpine3.24 AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/client/package.json packages/client/
COPY packages/app/package.json packages/app/
RUN npm ci --omit=dev --workspace @tuevento/admin --no-audit --no-fund

FROM node:24.21.0-alpine3.24 AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node apps/admin/package.json apps/admin/
COPY --chown=node:node apps/admin/src apps/admin/src
COPY --chown=node:node apps/admin/public apps/admin/public
USER node
EXPOSE 3088
CMD ["node", "apps/admin/src/server.mjs"]
