#!/usr/bin/env bash
# SOLO PARA PRUEBAS en CI de macOS, donde no hay Docker: levanta la API y PostgreSQL
# directamente en el runner, con el mismo HTTPS de pruebas (Caddy) que mobile-tls.
#   bash scripts/mobile-native-stack.sh start | stop
# Pensado para los runners de GitHub (brew instala postgresql@18 y caddy); no es la forma de
# trabajar en local: allí se usa Docker (compose.yml, perfil mobile).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="$PWD/tests/mobile/.stack"
PGDATA="$DIR/pg"
export XDG_DATA_HOME="$DIR/caddy-data"

case "${1:-}" in
  start)
    mkdir -p "$DIR"
    brew list postgresql@18 >/dev/null 2>&1 || brew install postgresql@18
    brew list caddy >/dev/null 2>&1 || brew install caddy
    PGBIN="$(brew --prefix postgresql@18)/bin"

    echo "▸ PostgreSQL"
    rm -rf "$PGDATA"
    "$PGBIN/initdb" -D "$PGDATA" -U tuevento --auth=trust >/dev/null
    "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5432 -k $DIR" -l "$DIR/pg.log" -w start >/dev/null
    "$PGBIN/createdb" -h "$DIR" -U tuevento tueventofun
    PATH="$PGBIN:$PATH" PGHOST="$DIR" POSTGRES_USER=tuevento POSTGRES_DB=tueventofun \
      API_DB_PASSWORD=ci-api sh services/postgres/initdb/00-roles.sh >/dev/null

    echo "▸ API"
    npm run build -w @tuevento/contracts -w @tuevento/api >/dev/null
    NODE_ENV=development PORT=3087 DATABASE_URL="postgres://api@127.0.0.1:5432/tueventofun" PGPASSWORD=ci-api \
      ALLOWED_ORIGINS="https://localhost:8443" COOKIE_SECURE=false DEMO_ENABLED=true \
      nohup node apps/api/dist/main.js >"$DIR/api.log" 2>&1 &
    echo $! >"$DIR/api.pid"
    for _ in $(seq 1 60); do
      curl -fs http://127.0.0.1:3087/api/health >/dev/null && break
      sleep 1
    done
    curl -fs http://127.0.0.1:3087/api/health >/dev/null || { cat "$DIR/api.log"; echo "La API no arrancó" >&2; exit 1; }

    echo "▸ HTTPS de pruebas (Caddy)"
    MOBILE_TLS_UPSTREAM=127.0.0.1:3087 nohup caddy run --config services/mobile-tls/Caddyfile --adapter caddyfile \
      >"$DIR/caddy.log" 2>&1 &
    echo $! >"$DIR/caddy.pid"
    for _ in $(seq 1 30); do
      [ -s "$XDG_DATA_HOME/caddy/pki/authorities/local/root.crt" ] && break
      sleep 1
    done
    echo "✓ Pila nativa lista en https://localhost:8443" ;;
  stop)
    for p in caddy api; do
      [ -f "$DIR/$p.pid" ] && kill "$(cat "$DIR/$p.pid")" 2>/dev/null || true
    done
    PGBIN="$(brew --prefix postgresql@18 2>/dev/null)/bin"
    [ -d "$PGDATA" ] && "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true ;;
  *) echo "Uso: $0 start|stop" >&2; exit 2 ;;
esac
