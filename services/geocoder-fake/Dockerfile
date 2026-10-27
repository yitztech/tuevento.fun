# Doble de Nominatim solo para pruebas (compose.yml y compose.ci.yml, nunca en producción)
FROM node:24.22.0-alpine3.24
WORKDIR /app
COPY services/geocoder-fake/server.mjs .
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
