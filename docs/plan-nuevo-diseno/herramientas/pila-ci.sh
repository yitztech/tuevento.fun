#!/usr/bin/env bash
# La pila de CI en local: las imágenes de producción, con los dobles de pruebas. La suite web solo
# es fiable aquí: en la pila de desarrollo fallan indexación, pagos y páginas de proveedor.
#   bash docs/plan-nuevo-diseno/herramientas/pila-ci.sh sube          # apaga desarrollo y la levanta
#   bash docs/plan-nuevo-diseno/herramientas/pila-ci.sh e2e "@sitio"  # escenarios con ese filtro
#   bash docs/plan-nuevo-diseno/herramientas/pila-ci.sh todo          # toda la suite web y de navegador
#   bash docs/plan-nuevo-diseno/herramientas/pila-ci.sh baja          # la apaga y vuelve a desarrollo
set -uo pipefail
export COMPOSE_PROJECT_NAME=tueventofun-ci COMPOSE_FILE=compose.prod.yml:compose.ci.yml
ci() { docker compose --env-file .env.ci "$@"; }
dev() { env -u COMPOSE_PROJECT_NAME -u COMPOSE_FILE docker compose "$@"; }
e2e() {
  # Sin esto, un run que no llega a empezar enseña el resumen del anterior
  rm -f tests/e2e/results/results.json
  if [ -n "${1:-}" ]; then npm run e2e -- --grep "$1"; else npm run e2e; fi
  local salida=$?
  npm run e2e:summary | tail -4
  return $salida
}
case "${1:-}" in
  sube) dev stop && ci up -d --build --wait ;;
  baja) ci down && dev up -d --build --wait ;;
  e2e) e2e "${2:-}" ;;
  todo)
    fallos=""
    e2e "" || fallos="$fallos e2e"
    for prueba in test:platform test:browser test:landing test:password; do
      npm run "$prueba" > "${TMPDIR:-/tmp}/$prueba.log" 2>&1 || fallos="$fallos $prueba"
    done
    node scripts/test-owner-browser.cjs > "${TMPDIR:-/tmp}/owner.log" 2>&1 || fallos="$fallos test-owner-browser"
    # Las pruebas de navegador reescriben estas capturas versionadas: no son un cambio de la tarea
    git checkout -- .impeccable/review
    if [ -n "$fallos" ]; then echo "FALLARON:$fallos"; exit 1; fi
    echo "TODO CORRECTO"
    ;;
  *) echo "Uso: pila-ci.sh sube|e2e [filtro]|todo|baja" >&2; exit 2 ;;
esac
