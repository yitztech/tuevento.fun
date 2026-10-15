#!/bin/sh
# Un idioma por dominio. Los idiomas y sus rutas traducidas salen de packages/contracts:
# locales-manifest.cjs los escribe en /etc/nginx/locales.txt al construir la imagen. El
# dominio de cada idioma llega en SITE_URL_<IDIOMA> (lo pone la plataforma; para el
# principal vale también SITE_URL). Genera:
#   - /etc/nginx/conf.d/sites.conf: $site_lang según el Host (el dominio de un idioma o su
#     www → ese idioma; cualquier otro Host → el principal), el origen y la ruta de la
#     petición en cada idioma, y $seo_links / $seo_sites_meta para el HTML.
#   - /etc/nginx/seo/robots-<idioma>.txt y sitemap-<idioma>.xml.
# Un idioma sin dominio no se publica: no tiene Host, hreflang ni sitemap.
# Igual que 16-analytics.sh, se lee el entorno aquí y no en la plantilla, para no
# ampliar NGINX_ENVSUBST_FILTER.
set -eu

manifest=${LOCALES_MANIFEST:-/etc/nginx/locales.txt}
if [ ! -r "$manifest" ]; then
  echo "17-sites.sh: falta $manifest (lo genera services/web/locales-manifest.cjs)" >&2
  exit 1
fi
default=$(awk '$1 == "default" { print $2 }' "$manifest")
pages=$(awk '$1 == "path" { print $2 }' "$manifest" | uniq)

upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }
check_origin() {
  # Solo esquema y host (puerto opcional): se inserta tal cual en HTML y en nginx
  if ! printf '%s' "$2" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$'; then
    echo "17-sites.sh: $1 debe ser un origen http(s):// sin ruta, recibido: $2" >&2
    exit 1
  fi
}
host_of() { printf '%s' "$1" | sed -E 's#^https?://##; s#:[0-9]+$##' | tr '[:upper:]' '[:lower:]'; }
# Ruta de una página en un idioma: las páginas traducidas se nombran con @ (@privacy)
path_of() {
  case $1 in
    @*) awk -v page="${1#@}" -v lang="$2" '$1 == "path" && $2 == page && $3 == lang { print $4 }' "$manifest" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# Idiomas con dominio, el principal primero
locales=""
for lang in $default $(awk -v d="$default" '$1 == "locale" && $2 != d { print $2 }' "$manifest"); do
  var="SITE_URL_$(upper "$lang")"
  eval "origin=\${$var:-}"
  if [ -z "$origin" ] && [ "$lang" = "$default" ]; then
    var=SITE_URL
    origin=${SITE_URL:-}
  fi
  if [ -z "$origin" ]; then
    if [ "$lang" = "$default" ]; then
      echo "17-sites.sh: falta SITE_URL_$(upper "$lang") (o SITE_URL), el dominio del idioma principal" >&2
      exit 1
    fi
    echo "17-sites.sh: sin SITE_URL_$(upper "$lang"): el idioma $lang no se publica" >&2
    continue
  fi
  check_origin "$var" "$origin"
  origin=${origin%/}
  host=$(host_of "$origin")
  for other in $locales; do
    eval "other_host=\$host_$other"
    if [ "$other_host" = "$host" ]; then
      echo "17-sites.sh: $lang y $other no pueden compartir el dominio $host" >&2
      exit 1
    fi
  done
  eval "origin_$lang=\$origin; host_$lang=\$host"
  locales="$locales $lang"
done

conf=/etc/nginx/conf.d/sites.conf
{
  echo '# Generado por 17-sites.sh. Host desconocido → idioma principal.'
  echo 'map $host $site_lang {'
  echo "    default $default;"
  for lang in $locales; do
    [ "$lang" = "$default" ] && continue
    eval "host=\$host_$lang"
    echo "    $host $lang;"
    echo "    www.$host $lang;"
  done
  echo '}'
  echo ''
  echo '# Puerto en la cabecera Host si el cliente usa uno distinto a 80/443 (desarrollo local)'
  echo 'map $http_host $client_port {'
  echo '    "~:(?<p>[0-9]+)$" ":$p";'
  echo '    default "";'
  echo '}'
  echo ''
  echo '# Origen de cada idioma. En local (localhost o un dominio con puerto explícito) los'
  echo '# enlaces conservan el puerto y usan HTTP: el principal en localhost, los demás en su host.'
  for lang in $locales; do
    eval "origin=\$origin_$lang; host=\$host_$lang"
    if [ "$lang" = "$default" ]; then local_origin='http://localhost$client_port'; else local_origin="http://$host\$client_port"; fi
    echo "map \$http_host \$origin_$lang {"
    echo "    \"~^(localhost|127\\.0\\.0\\.1)(:[0-9]+)?\$\" \"$local_origin\";"
    for other in $locales; do
      [ "$other" = "$default" ] && continue
      eval "other_host=\$host_$other"
      echo "    \"~^(www\\.)?$(printf '%s' "$other_host" | sed 's/\./\\./g'):[0-9]+\$\" \"$local_origin\";"
    done
    echo "    default \"$origin\";"
    echo '}'
  done
  echo ''
  echo 'map $site_lang $site_origin {'
  echo "    default \$origin_$default;"
  for lang in $locales; do echo "    $lang \$origin_$lang;"; done
  echo '}'
  echo ''
  echo '# Ruta de la petición sin query. Solo caracteres seguros: se inserta en el HTML,'
  echo '# así que cualquier otra cosa se reduce a "/".'
  echo 'map $request_uri $seo_raw_path {'
  echo '    "~^(?<seo_p>/[A-Za-z0-9/_.~-]*)(\?.*)?$" $seo_p;'
  echo '    default "/";'
  echo '}'
  echo '# La misma ruta en cada idioma (mapa común de packages/contracts)'
  for lang in $locales; do
    echo "map \$seo_raw_path \$seo_path_$lang {"
    echo '    default $seo_raw_path;'
    for page in $pages; do
      own=$(path_of "@$page" "$lang")
      awk -v page="$page" -v own="$own" '$1 == "path" && $2 == page && $4 != own { print $4 }' "$manifest" |
        sort -u | while read -r from; do echo "    $from $own;"; done
    done
    echo '}'
  done
  echo 'map $site_lang $seo_path {'
  echo "    default \$seo_path_$default;"
  for lang in $locales; do echo "    $lang \$seo_path_$lang;"; done
  echo '}'
  echo ''
  # canonical en su propio dominio, hreflang hacia cada idioma y x-default al principal
  sites=""
  alternates=""
  for lang in $locales; do
    sites="$sites${sites:+ }$lang=\$origin_$lang"
    alternates="$alternates<link rel=\"alternate\" hreflang=\"$lang\" href=\"\$origin_$lang\$seo_path_$lang\"/>"
  done
  echo '# Marcas que sustituyen a <meta name="tuevento-seo"/> en index.html'
  echo "map \$site_lang \$seo_sites_meta { default '<meta name=\"tuevento:sites\" content=\"$sites\"/>'; }"
  echo "map \$site_lang \$seo_links { default '<link rel=\"canonical\" href=\"\$site_origin\$seo_path\"/>$alternates<link rel=\"alternate\" hreflang=\"x-default\" href=\"\$origin_$default\$seo_path_$default\"/>\$seo_sites_meta'; }"
} > "$conf"

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
/ayuda
/recuperar-contrasena
/nueva-contrasena'

# Páginas públicas; las traducidas, con @ y su nombre en packages/contracts
public_pages="/ /descargas /registro /acceso $(printf '@%s ' $pages)"

for lang in $locales; do
  eval "own=\$origin_$lang"
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
    for page in $public_pages; do
      echo '  <url>'
      echo "    <loc>$own$(path_of "$page" "$lang")</loc>"
      for alt in $locales; do
        eval "alt_origin=\$origin_$alt"
        echo "    <xhtml:link rel=\"alternate\" hreflang=\"$alt\" href=\"$alt_origin$(path_of "$page" "$alt")\"/>"
      done
      eval "default_origin=\$origin_$default"
      echo "    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"$default_origin$(path_of "$page" "$default")\"/>"
      echo '  </url>'
    done
    echo '</urlset>'
  } > "/etc/nginx/seo/sitemap-$lang.xml"
done
