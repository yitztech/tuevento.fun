#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  umask 077
  node - <<'NODE'
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
fs.writeFileSync('.env', fs.readFileSync('.env.example', 'utf8').replace('REPLACE_WITH_A_RANDOM_SECRET', randomBytes(32).toString('hex')), { mode: 0o600, flag: 'wx' });
NODE
  echo 'Entorno local creado con una contraseña aleatoria de base de datos.'
fi
docker compose up -d --build --wait
printf '\nTuEventoFun está disponible en http://localhost:5187\n'
