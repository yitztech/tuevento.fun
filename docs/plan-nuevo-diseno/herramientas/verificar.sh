#!/usr/bin/env bash
# Comprobaciones de cada tarea. Termina con «VERIFICACIÓN CORRECTA» o con el paso que falló.
# Uso: bash docs/plan-nuevo-diseno/herramientas/verificar.sh
set -uo pipefail
paso() {
  echo "▸ $1"
  shift
  if ! "$@" > "${TMPDIR:-/tmp}/verificar.log" 2>&1; then
    tail -40 "${TMPDIR:-/tmp}/verificar.log"
    echo
    echo "FALLÓ: $*"
    exit 1
  fi
}
paso "Contratos" npm run build -w @tuevento/contracts
paso "Cliente" npm run build -w @tuevento/client
paso "Lint" npm run lint
paso "Tipos" npm run typecheck
paso "Unitarias" npm run test:unit
echo "VERIFICACIÓN CORRECTA"
