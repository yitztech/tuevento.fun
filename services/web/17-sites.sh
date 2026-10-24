#!/bin/sh
# Un dominio por idioma, salvo los idiomas alojados en el dominio de otro bajo /<código>
# (yourevent.fun/pt). Los idiomas y sus rutas traducidas salen de packages/contracts:
# locales-manifest.cjs los escribe en /etc/nginx/locales.txt al construir la imagen. El
# dominio de cada idioma llega en SITE_URL_<IDIOMA> (lo pone la plataforma; para el
# principal vale también SITE_URL). Genera:
#   - /etc/nginx/conf.d/sites.conf: $site_lang según el Host (el dominio de un idioma o su
#     www → ese idioma; cualquier otro Host → el principal), $page_lang (el del dominio o
#     el alojado si la ruta empieza por su prefijo), el origen y la ruta de la petición en
#     cada idioma, y $seo_links / $seo_sites_meta para el HTML.
#   - /etc/nginx/seo/robots-<dominio>.txt y sitemap-<dominio>.xml (con sus idiomas alojados).
# Un idioma cuyo dominio no se publica tampoco: no tiene Host, hreflang ni sitemap.
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

hosted_of() { awk -v lang="$1" '$1 == "hosted" && $2 == lang { print $3 }' "$manifest"; }

# Idiomas con dominio propio, el principal primero
locales=""
for lang in $default $(awk -v d="$default" '$1 == "locale" && $2 != d { print $2 }' "$manifest"); do
  [ -n "$(hosted_of "$lang")" ] && continue
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
  eval "origin_$lang=\$origin; host_$lang=\$host; site_$lang=\$lang; prefix_$lang="
  locales="$locales $lang"
done

# Todos los idiomas publicados: los de dominio propio y los alojados en uno publicado
pages_locales="$locales"
for lang in $(awk '$1 == "hosted" { print $2 }' "$manifest"); do
  site=$(hosted_of "$lang")
  case " $locales " in
    *" $site "*) ;;
    *) echo "17-sites.sh: el dominio de $site no se publica: el idioma $lang tampoco" >&2; continue ;;
  esac
  eval "site_$lang=\$site; prefix_$lang=/\$lang"
  pages_locales="$pages_locales $lang"
done
# URL de una ruta ya traducida en un idioma: origen de su sitio + prefijo + ruta
url_of() {
  eval "site=\$site_$1; prefix=\$prefix_$1"
  eval "origin=\$origin_$site"
  if [ -n "$prefix" ] && [ "$2" = "/" ]; then printf '%s%s/' "$origin" "$prefix"; else printf '%s%s%s' "$origin" "$prefix" "$2"; fi
}

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
  echo '# Ruta de la petición sin query. Solo caracteres seguros: se inserta en el HTML,'
  echo '# así que cualquier otra cosa se reduce a "/".'
  echo 'map $request_uri $seo_raw_path {'
  echo '    "~^(?<seo_p>/[A-Za-z0-9/_.~-]*)(\?.*)?$" $seo_p;'
  echo '    default "/";'
  echo '}'
  echo '# Idioma de la página: el del dominio o, si la ruta empieza por /<código>, el alojado.'
  echo '# $seo_rest es la ruta sin ese prefijo.'
  echo 'map "$site_lang $seo_raw_path" $page_lang {'
  echo '    default $site_lang;'
  for lang in $pages_locales; do
    eval "site=\$site_$lang; prefix=\$prefix_$lang"
    if [ -n "$prefix" ]; then echo "    \"~^$site $prefix(/.*)?\$\" $lang;"; fi
  done
  echo '}'
  echo 'map "$site_lang $seo_raw_path" $seo_rest {'
  echo '    default $seo_raw_path;'
  for lang in $pages_locales; do
    eval "site=\$site_$lang; prefix=\$prefix_$lang"
    [ -z "$prefix" ] && continue
    echo "    \"~^$site $prefix\$\" /;"
    echo "    \"~^$site $prefix(?<seo_rest_$lang>/.*)\$\" \$seo_rest_$lang;"
  done
  echo '}'
  echo '# Prefijo de un idioma en un dominio que no es el suyo (tuevento.fun/pt/…, tuevento.fun/en/…): 301 a su dominio'
  echo 'map "$site_lang $seo_raw_path" $locale_redirect {'
  echo '    default "";'
  for lang in $pages_locales; do
    eval "site=\$site_$lang; prefix=\$prefix_$lang"
    [ -z "$prefix" ] && continue
    for other in $locales; do
      if [ "$other" != "$site" ]; then echo "    \"~^$other $prefix(/.*)?\$\" \$origin_$site\$request_uri;"; fi
    done
  done
  # /<código> de un idioma con dominio propio en otro dominio (tuevento.fun/en/…): 301 a
  # la misma ruta sin el prefijo en su dominio, para no servir el idioma equivocado
  for lang in $locales; do
    for other in $locales; do
      [ "$other" = "$lang" ] && continue
      echo "    \"~^$other /$lang/?\$\" \$origin_$lang/\$is_args\$args;"
      echo "    \"~^$other /$lang(?<locale_rest_${other}_$lang>/.+)\$\" \$origin_$lang\$locale_rest_${other}_$lang\$is_args\$args;"
    done
  done
  echo '}'
  echo '# La misma ruta en cada idioma (mapa común de packages/contracts)'
  for lang in $pages_locales; do
    echo "map \$seo_rest \$seo_path_$lang {"
    echo '    default $seo_rest;'
    for page in $pages; do
      own=$(path_of "@$page" "$lang")
      awk -v page="$page" -v own="$own" '$1 == "path" && $2 == page && $4 != own { print $4 }' "$manifest" |
        sort -u | while read -r from; do echo "    $from $own;"; done
    done
    echo '}'
  done
  # URL de la petición en cada idioma: origen de su sitio + prefijo + ruta traducida
  seo_url() {
    eval "site=\$site_$1; prefix=\$prefix_$1"
    printf '$origin_%s%s$seo_path_%s' "$site" "$prefix" "$1"
  }
  echo '# canonical: la URL de la página en su propio idioma'
  echo 'map $page_lang $seo_canonical {'
  echo "    default \"$(seo_url "$default")\";"
  for lang in $pages_locales; do echo "    $lang \"$(seo_url "$lang")\";"; done
  echo '}'
  echo ''
  # canonical en su propia URL, hreflang hacia cada idioma y x-default al principal.
  # tuevento:sites solo lleva los dominios: la SPA calcula los prefijos con la tabla.
  sites=""
  alternates=""
  for lang in $locales; do sites="$sites${sites:+ }$lang=\$origin_$lang"; done
  for lang in $pages_locales; do
    alternates="$alternates<link rel=\"alternate\" hreflang=\"$lang\" href=\"$(seo_url "$lang")\"/>"
  done
  echo '# <title> y <meta name="description"> del HTML inicial, en el idioma de la página'
  for kind in title description; do
    echo "map \$page_lang \$seo_$kind {"
    for lang in $pages_locales; do
      text=$(awk -v kind="$kind" -v lang="$lang" '$1 == kind && $2 == lang { sub(/^[a-z]+ [a-z]+ /, ""); print }' "$manifest")
      [ "$lang" = "$default" ] && echo "    default \"$text\";"
      echo "    $lang \"$text\";"
    done
    echo '}'
  done
  echo '# Marcas que sustituyen a <meta name="tuevento-seo"/> en index.html'
  echo "map \$site_lang \$seo_sites_meta { default '<meta name=\"tuevento:sites\" content=\"$sites\"/>'; }"
  echo "map \$site_lang \$seo_links { default '<link rel=\"canonical\" href=\"\$seo_canonical\"/>$alternates<link rel=\"alternate\" hreflang=\"x-default\" href=\"\$origin_$default\$seo_path_$default\"/>\$seo_sites_meta'; }"
} > "$conf"

mkdir -p /etc/nginx/seo

# Rutas privadas o de sesión: no se indexan
disallow='/app
/app-link/
/i/
/e/
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
    # Las páginas de este dominio y las de los idiomas que aloja
    for page_lang in $pages_locales; do
      eval "page_site=\$site_$page_lang"
      [ "$page_site" = "$lang" ] || continue
      for page in $public_pages; do
        echo '  <url>'
        echo "    <loc>$(url_of "$page_lang" "$(path_of "$page" "$page_lang")")</loc>"
        for alt in $pages_locales; do
          echo "    <xhtml:link rel=\"alternate\" hreflang=\"$alt\" href=\"$(url_of "$alt" "$(path_of "$page" "$alt")")\"/>"
        done
        echo "    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"$(url_of "$default" "$(path_of "$page" "$default")")\"/>"
        echo '  </url>'
      done
    done
    echo '</urlset>'
  } > "/etc/nginx/seo/sitemap-$lang.xml"
done
