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
elif grep -q '^DB_PASSWORD=' .env && ! grep -q '^POSTGRES_PASSWORD=' .env; then
  # .env anteriores usaban DB_PASSWORD; compose.yml ahora espera POSTGRES_PASSWORD
  sed -i.bak 's/^DB_PASSWORD=/POSTGRES_PASSWORD=/' .env && rm -f .env.bak
  echo 'DB_PASSWORD renombrada a POSTGRES_PASSWORD en .env.'
fi
docker compose up -d --build --wait
printf '\nTuEventoFun está disponible en http://localhost:5187'
printf '\nCon OrbStack: https://tueventofun.orb.local (es) y https://en.tueventofun.orb.local (en)\n'
