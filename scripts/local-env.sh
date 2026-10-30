#!/usr/bin/env bash
# Entornos locales de TuEventoFun, iguales en cualquier máquina con Docker Compose (v2.24 o más):
#   limpio  compose.yml                     sin usuarios · web 5187, API 3087, correos 8026
#   demo    compose.yml + compose.demo.yml  con 20 organizadores, sus eventos y 20 proveedores
#                                           · web 5287, API 3187, correos 8126
# Cada uno es un proyecto de Compose aparte (tueventofun y tueventofun-demo): pueden correr a la vez.
#   bash scripts/local-env.sh limpio | demo           levanta (y siembra, en demo)
#   bash scripts/local-env.sh parar  limpio | demo    detiene sin borrar datos
#   bash scripts/local-env.sh borrar limpio | demo    borra contenedores, volúmenes e imágenes
#   bash scripts/local-env.sh estado
set -euo pipefail
cd "$(dirname "$0")/.."

command=${1:-estado}
target=${2:-}

# .env (si existe) y .env.demo (contraseña de las cuentas demo; ambos fuera de git)
env_args=()
[ -f .env ] && env_args+=(--env-file .env)
[ -f .env.demo ] && env_args+=(--env-file .env.demo)

compose_limpio() { docker compose "${env_args[@]}" "$@"; }
compose_demo() { docker compose "${env_args[@]}" -f compose.yml -f compose.demo.yml "$@"; }

# Valor de una variable de .env (o el de por defecto del compose)
var() { { grep -hE "^$1=" .env .env.demo 2>/dev/null || true; } | tail -1 | cut -d= -f2; }

case "$command" in
  limpio)
    compose_limpio up -d --build --wait
    port=$(var WEB_PORT); port=${port:-5187}
    printf '\nEntorno limpio (sin usuarios): http://tuevento.localhost:%s (es) · http://yourevent.localhost:%s (en) · correos http://127.0.0.1:8026\n' "$port" "$port"
    ;;
  demo)
    if [ ! -f .env.demo ]; then
      (umask 077; printf 'DEMO_PASSWORD=%s\n' "$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')" > .env.demo)
      env_args+=(--env-file .env.demo)
    fi
    compose_demo up -d --build --wait
    compose_demo run --rm --build seed
    port=$(var DEMO_WEB_PORT); port=${port:-5287}
    printf '\nEntorno demo: http://tuevento.localhost:%s (es) · http://yourevent.localhost:%s (en) · correos http://127.0.0.1:8126\n' "$port" "$port"
    printf 'Cuentas: demo-organizador-01..20@example.invalid y demo-proveedor-01..20@example.invalid\n'
    printf 'Contraseña de todas (guardada en .env.demo): %s\n' "$(var DEMO_PASSWORD)"
    ;;
  parar | borrar)
    action=(stop)
    [ "$command" = borrar ] && action=(down -v --remove-orphans --rmi local)
    case "$target" in
      limpio) compose_limpio --profile mobile "${action[@]}" ;;
      demo)
        compose_demo --profile seed --profile mobile "${action[@]}"
        if [ "$command" = borrar ]; then rm -f .env.demo; fi
        ;;
      *) echo "Indica el entorno: limpio o demo" >&2; exit 2 ;;
    esac
    ;;
  estado) docker compose ls --all --filter name=tueventofun ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac
