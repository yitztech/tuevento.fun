#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  umask 077
  node - <<'NODE'
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const template = fs.readFileSync('.env.example', 'utf8')
  .replace('REPLACE_WITH_A_RANDOM_SECRET', randomBytes(32).toString('hex'))
  .replace('REPLACE_WITH_A_RANDOM_SECRET_API', randomBytes(32).toString('hex'));
fs.writeFileSync('.env', template, { mode: 0o600, flag: 'wx' });
NODE
  echo 'Entorno local creado con contraseñas aleatorias de base de datos.'
else
  if grep -q '^DB_PASSWORD=' .env && ! grep -q '^POSTGRES_PASSWORD=' .env; then
    sed -i.bak 's/^DB_PASSWORD=/POSTGRES_PASSWORD=/' .env && rm -f .env.bak
    echo 'DB_PASSWORD renombrada a POSTGRES_PASSWORD en .env.'
  fi
  if ! grep -q '^API_DB_PASSWORD=' .env; then
    node - <<'NODE'
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
fs.appendFileSync('.env', `\nAPI_DB_PASSWORD=${randomBytes(32).toString('hex')}\n`);
NODE
    echo 'API_DB_PASSWORD agregada a .env.'
  fi
fi
docker compose up -d --build --wait
printf '\nTuEventoFun está disponible en http://localhost:5187'
printf '\nCon OrbStack: https://tueventofun.orb.local (es) y https://en.tueventofun.orb.local (en)\n'
