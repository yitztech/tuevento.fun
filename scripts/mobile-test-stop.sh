#!/usr/bin/env bash
# SOLO PARA PRUEBAS. Apaga el emulador de Android o los simuladores de iOS y espera a que
# estén apagados del todo (dos a la vez saturan la máquina y las pruebas fallan por tiempo).
#   bash scripts/mobile-test-stop.sh android | ios
set -uo pipefail
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"

case "${1:-}" in
  android)
    [ -x "$ADB" ] || exit 0
    for serial in $("$ADB" devices | awk '/^emulator-/ {print $1}'); do
      echo "▸ Apagando emulador de Android ($serial)"
      "$ADB" -s "$serial" emu kill >/dev/null 2>&1 || true
    done
    for _ in $(seq 1 30); do
      "$ADB" devices | grep -q '^emulator-' || exit 0
      sleep 1
    done
    echo "El emulador de Android sigue encendido" >&2; exit 1 ;;
  ios)
    command -v xcrun >/dev/null || exit 0
    if xcrun simctl list devices booted | grep -q '(Booted)'; then
      echo "▸ Apagando simuladores de iOS"
      xcrun simctl shutdown all >/dev/null 2>&1 || true
    fi
    for _ in $(seq 1 30); do
      xcrun simctl list devices booted | grep -q '(Booted)' || exit 0
      sleep 1
    done
    echo "Un simulador de iOS sigue encendido" >&2; exit 1 ;;
  *) echo "Uso: $0 android|ios" >&2; exit 2 ;;
esac
