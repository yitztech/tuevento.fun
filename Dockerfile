FROM node:22-bookworm-slim AS build
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

FROM node:22-bookworm-slim AS backend
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/contracts ./packages/contracts
COPY --from=build --chown=node:node /app/packages/client ./packages/client
COPY --from=build --chown=node:node /app/apps/api ./apps/api
USER node
EXPOSE 3087
CMD ["node", "apps/api/dist/main.js"]

FROM nginx:1.29-alpine AS frontend
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
