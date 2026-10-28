#!/bin/sh
# Analítica con Umami: si hay UMAMI_SCRIPT_URL y UMAMI_WEBSITE_ID, el contenedor web inserta
# el script en el HTML y amplía la CSP con el origen de Umami. Sin valores no se carga
# nada de terceros.
#   UMAMI_SCRIPT_URL   p. ej. https://stats.yunitztech.com/script.js
#   UMAMI_WEBSITE_ID   UUID de la web en Umami
set -eu

origin=""
# En conf.d (tmpfs: la imagen corre con el sistema de archivos de solo lectura). La extensión
# .snippet evita que nginx lo incluya en el bloque http: solo lo incluye la location de la SPA.
snippet=/etc/nginx/conf.d/analytics.snippet
rm -f "$snippet"

if [ -n "${UMAMI_SCRIPT_URL:-}" ] && [ -n "${UMAMI_WEBSITE_ID:-}" ]; then
  case "$UMAMI_SCRIPT_URL" in
    https://*) ;;
    *) echo "16-analytics.sh: UMAMI_SCRIPT_URL debe empezar por https://" >&2; exit 1 ;;
  esac
  origin=$(printf '%s' "$UMAMI_SCRIPT_URL" | sed -E 's#^(https://[^/]+).*#\1#')
  cat > "$snippet" <<CONF
# Generado por 16-analytics.sh: script de Umami en las páginas HTML
proxy_set_header Accept-Encoding "";
sub_filter_types text/html;
sub_filter_once on;
sub_filter '</head>' '<script defer src="${UMAMI_SCRIPT_URL}" data-website-id="${UMAMI_WEBSITE_ID}"></script></head>';
CONF
fi

# Registro de errores (AUDITORIA INT-08): con SENTRY_DSN, la CSP permite conectar con el origen
# de Bugsink, adonde el SDK del navegador manda los errores
errores=""
if [ -n "${SENTRY_DSN:-}" ]; then
  case "$SENTRY_DSN" in
    https://*) ;;
    *) echo "16-analytics.sh: SENTRY_DSN debe empezar por https://" >&2; exit 1 ;;
  esac
  # Sin la clave (lo que va antes de @) ni el proyecto: solo https://host
  errores=$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https://([^@/]*@)?([^/]+).*#https://\2#')
fi

# Orígenes extra de la CSP: Umami en script-src y connect-src; Bugsink solo en connect-src
{
  printf 'map $host $analytics_src { default "%s"; }\n' "${origin:+ $origin}"
  printf 'map $host $errores_src { default "%s"; }\n' "${errores:+ $errores}"
} > /etc/nginx/conf.d/analytics.conf
