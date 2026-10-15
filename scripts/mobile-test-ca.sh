#!/usr/bin/env bash
# SOLO PARA PRUEBAS. Exporta la CA local del servicio `mobile-tls` (compose.yml, perfil
# `mobile`) a tests/mobile/.ca/root.crt para confiar en ella en el build de depuración de
# Android o en el simulador de iOS. Es un certificado público y de pruebas, no un secreto.
set -euo pipefail
cd "$(dirname "$0")/.."
out=tests/mobile/.ca
mkdir -p "$out"
for _ in $(seq 1 30); do
  docker compose --profile mobile cp mobile-tls:/data/caddy/pki/authorities/local/root.crt "$out/root.crt" 2>/dev/null && break
  sleep 1
done
[ -s "$out/root.crt" ] || { echo "No se pudo leer la CA: ¿está arriba mobile-tls?" >&2; exit 1; }
openssl x509 -in "$out/root.crt" -noout -subject -enddate
echo "CA exportada en $out/root.crt"
