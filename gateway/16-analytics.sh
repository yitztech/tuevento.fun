#!/bin/sh
# Analítica con Umami: si hay UMAMI_SCRIPT_URL y UMAMI_WEBSITE_ID, el gateway inserta
# el script en el HTML y amplía la CSP con el origen de Umami. Sin valores no se carga
# nada de terceros.
#   UMAMI_SCRIPT_URL   p. ej. https://stats.yunitztech.com/script.js
#   UMAMI_WEBSITE_ID   UUID de la web en Umami
set -eu

origin=""
snippet=/etc/nginx/snippets/analytics.conf
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

# Origen extra para script-src y connect-src de la CSP (vacío sin Umami)
printf 'map $host $analytics_src { default "%s"; }\n' "${origin:+ $origin}" > /etc/nginx/conf.d/analytics.conf
