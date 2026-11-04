#!/usr/bin/env node
// Borra de los cinco catálogos las claves que ya nadie usa, con el mismo criterio que
// packages/contracts/src/catalog.test.ts. Solo mira las áreas que se le pasan.
// Uso: node docs/plan-nuevo-diseno/herramientas/prune-keys.mjs landing common
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const areas = process.argv.slice(2);
if (!areas.length) {
  console.error("Uso: prune-keys.mjs <área> [<área>…]");
  process.exit(2);
}
const dirs = ["packages/app/src", "packages/contracts/src", "packages/client/src", "apps/api/src", "apps/web/src", "services/search"];
const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|go)$/.test(name) && !/(\.test\.ts|_test\.go)$/.test(name) ? [path] : [];
  });
const code = dirs.flatMap(sources).map((file) => readFileSync(file, "utf8")).join("\n");
const base = (key) => key.replace(/_(zero|one|two|few|many|other)$/, "");
const used = (key) => code.includes(`"${key}"`) || code.includes(`'${key}'`);

const removed = new Set();
for (const language of ["es", "en", "pt", "de", "fr"]) {
  const path = `packages/contracts/src/locales/${language}.json`;
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  for (const area of areas) {
    for (const key of Object.keys(catalog[area] ?? {})) {
      if (!used(`${area}.${base(key)}`)) {
        delete catalog[area][key];
        removed.add(`${area}.${base(key)}`);
      }
    }
  }
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`Claves borradas (${removed.size}):`);
for (const key of [...removed].sort()) console.log(`  ${key}`);
