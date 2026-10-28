# syntax=docker/dockerfile:1
# Imagen de `search`. Se construye desde la raíz del repositorio:
#   docker build -f services/search/Dockerfile .
# Los idiomas, límites, categorías y textos salen de packages/contracts (shared.json, embebido).
FROM node:24.22.0-alpine3.24 AS contracts
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
# typescript es de la raíz: declararlo en contracts lo metería en la imagen de la API (--omit=dev no lo excluye)
RUN npm ci --workspace @tuevento/contracts --include-workspace-root --no-audit --no-fund
COPY packages/contracts packages/contracts
RUN npm run build -w @tuevento/contracts

FROM golang:1.27.3-alpine3.24 AS build
WORKDIR /src
COPY services/search/go.mod services/search/go.sum ./
RUN go mod download
COPY services/search ./
COPY --from=contracts /app/services/search/internal/catalog/shared.json internal/catalog/shared.json
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/search ./cmd/search

# Binario estático sobre scratch: sin shell ni paquetes. El healthcheck es el mismo binario.
FROM scratch
COPY --from=build /out/search /search
USER 65532:65532
EXPOSE 3089
ENTRYPOINT ["/search"]
