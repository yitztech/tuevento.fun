#!/usr/bin/env bash
# SOLO PARA PRUEBAS. Ejecuta los escenarios @movil de una o varias plataformas, de una en una:
# antes de empezar una plataforma apaga la otra, y al terminarla la apaga. Así nunca hay un
# emulador de Android y un simulador de iOS encendidos a la vez.
#
#   bash scripts/mobile-test.sh android ios      # Android, se apaga, luego iOS, se apaga
#   bash scripts/mobile-test.sh ios android      # al revés
#   bash scripts/mobile-test.sh ios              # solo una
#
# Variables: MOBILE_VER=1    ritmo humano (e2e:<plataforma>:ver) para seguirlo a ojo
#            MOBILE_KEEP=1   deja encendida la última plataforma al terminar
#            SKIP_BUILD=1    reutiliza el APK / la app ya compilados
set -uo pipefail
cd "$(dirname "$0")/.."
[ "$#" -gt 0 ] || set -- android ios

otra() { if [ "$1" = android ]; then echo ios; else echo android; fi; }
for p in "$@"; do
  case "$p" in android|ios) ;; *) echo "Plataforma desconocida: $p (android o ios)" >&2; exit 2 ;; esac
done

resultado=0
resumen=""
total=$#
n=0
for plataforma in "$@"; do
  n=$((n + 1))
  echo; echo "══ $plataforma ($n/$total) ══"
  # 1. Apagar la otra plataforma antes de empezar esta.
  bash scripts/mobile-test-stop.sh "$(otra "$plataforma")" || resultado=1
  # 2. Preparar (compilar, arrancar, instalar) y ejecutar.
  script="e2e:$plataforma"; [ -n "${MOBILE_VER:-}" ] && script="e2e:$plataforma:ver"
  if bash "scripts/mobile-test-$plataforma.sh" && npm run "$script"; then
    resumen="$resumen\n  ✓ $plataforma"
  else
    resumen="$resumen\n  ✗ $plataforma"; resultado=1
  fi
  # 3. Apagar esta al terminar (salvo la última con MOBILE_KEEP=1).
  if [ "$n" -lt "$total" ] || [ -z "${MOBILE_KEEP:-}" ]; then
    bash scripts/mobile-test-stop.sh "$plataforma" || resultado=1
  fi
done

echo; echo "Resumen móvil:"; printf "$resumen\n"
exit "$resultado"
