#!/bin/sh
set -e

mkdir -p /run/nginx /etc/nginx/http.d /etc/nginx/conf.d

# Configurar mapas de idiomas y SEO según SITE_URL_ES y SITE_URL_EN
if [ -x /17-sites.sh ]; then
    /17-sites.sh
    if [ -f /etc/nginx/conf.d/sites.conf ]; then
        mv /etc/nginx/conf.d/sites.conf /etc/nginx/http.d/sites.conf
    fi
fi

cp /etc/nginx/templates/default.dev.conf.template /etc/nginx/http.d/default.conf
rm -f /etc/nginx/conf.d/default.conf

# Nginx en segundo plano (puerto 8080) delante de Vite
nginx

# Parar Nginx al recibir señales de parada del contenedor
cleanup() {
    echo "Parando Nginx..."
    nginx -s stop 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Arrancar Vite dev server en primer plano
cd /app
exec npm run dev -w @tuevento/web -- --host 127.0.0.1 --port 5187
