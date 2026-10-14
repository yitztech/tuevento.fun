#!/bin/sh
# Dos dominios, un idioma por dominio. Con SITE_URL_ES y SITE_URL_EN (las pone la
# plataforma) genera:
#   - /etc/nginx/conf.d/sites.conf: $site_lang según el Host (dominio de SITE_URL_EN o
#     su www → en; cualquier otro Host → es) y los orígenes de cada idioma.
#   - /etc/nginx/seo/robots-<idioma>.txt y sitemap-<idioma>.xml.
# Igual que 16-analytics.sh, se lee el entorno aquí y no en la plantilla, para no
# ampliar NGINX_ENVSUBST_FILTER. El mapa de rutas traducidas está en default.conf.template.
set -eu

origin_es=${SITE_URL_ES:-https://tuevento.fun}
origin_en=${SITE_URL_EN:-https://yourevent.fun}

check_origin() {
  # Solo esquema y host (puerto opcional): se inserta tal cual en HTML y en nginx
  if ! printf '%s' "$2" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$'; then
    echo "17-sites.sh: $1 debe ser un origen http(s):// sin ruta, recibido: $2" >&2
    exit 1
  fi
}
check_origin SITE_URL_ES "$origin_es"
check_origin SITE_URL_EN "$origin_en"
origin_es=${origin_es%/}
origin_en=${origin_en%/}

host_of() { printf '%s' "$1" | sed -E 's#^https?://##; s#:[0-9]+$##' | tr '[:upper:]' '[:lower:]'; }
host_es=$(host_of "$origin_es")
host_en=$(host_of "$origin_en")
if [ "$host_es" = "$host_en" ]; then
  echo "17-sites.sh: SITE_URL_ES y SITE_URL_EN deben tener dominios distintos" >&2
  exit 1
fi

cat > /etc/nginx/conf.d/sites.conf <<CONF
# Generado por 17-sites.sh. Host desconocido → es.
map \$host \$site_lang {
    default        es;
    $host_en       en;
    www.$host_en   en;
}
map \$host \$origin_es { default "$origin_es"; }
map \$host \$origin_en { default "$origin_en"; }
map \$site_lang \$site_origin { default "$origin_es"; en "$origin_en"; }
map \$site_lang \$alt_origin  { default "$origin_en"; en "$origin_es"; }
CONF

mkdir -p /etc/nginx/seo

# Rutas privadas o de sesión: no se indexan
disallow='/app
/app-link/
/i/
/eventos
/invitados
/notificaciones
/perfil
/administracion
/conectar-app
/disenos
/ayuda'

# Páginas públicas: "ruta en es|ruta en en"
public_pages='/|/
/descargas|/descargas
/registro|/registro
/acceso|/acceso
/privacidad|/privacy
/condiciones|/terms'

for lang in es en; do
  if [ "$lang" = es ]; then own=$origin_es; else own=$origin_en; fi
  {
    echo 'User-agent: *'
    echo 'Allow: /'
    printf '%s\n' "$disallow" | sed 's/^/Disallow: /'
    echo ''
    echo "Sitemap: $own/sitemap.xml"
  } > "/etc/nginx/seo/robots-$lang.txt"

  {
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    printf '%s\n' "$public_pages" | while IFS='|' read -r path_es path_en; do
      if [ "$lang" = es ]; then path=$path_es; else path=$path_en; fi
      echo '  <url>'
      echo "    <loc>$own$path</loc>"
      echo "    <xhtml:link rel=\"alternate\" hreflang=\"es\" href=\"$origin_es$path_es\"/>"
      echo "    <xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"$origin_en$path_en\"/>"
      echo "    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"$origin_es$path_es\"/>"
      echo '  </url>'
    done
    echo '</urlset>'
  } > "/etc/nginx/seo/sitemap-$lang.xml"
done
