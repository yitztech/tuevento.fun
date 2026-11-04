#!/usr/bin/env node
// Añade a los cinco catálogos las claves de un archivo de traducciones. No traduce: las
// traducciones ya vienen escritas en docs/plan-nuevo-diseno/traducciones/.
// Uso: node docs/plan-nuevo-diseno/herramientas/add-keys.mjs docs/plan-nuevo-diseno/traducciones/T07.json
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: add-keys.mjs <archivo de traducciones>");
  process.exit(2);
}
const entries = JSON.parse(readFileSync(file, "utf8"));
const languages = ["es", "en", "pt", "de", "fr"];

for (const [key, values] of Object.entries(entries)) {
  for (const language of languages) {
    if (typeof values[language] !== "string" || !values[language]) {
      console.error(`Falta ${language} en ${key}`);
      process.exit(1);
    }
  }
}
const sort = (node) =>
  Object.fromEntries(
    Object.keys(node)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, typeof node[k] === "object" ? sort(node[k]) : node[k]]),
  );
let added = 0;
for (const language of languages) {
  const path = `packages/contracts/src/locales/${language}.json`;
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  for (const [key, values] of Object.entries(entries)) {
    const [area, ...rest] = key.split(".");
    if (rest.length !== 1) {
      console.error(`Clave con formato raro: ${key}`);
      process.exit(1);
    }
    catalog[area] ??= {};
    if (!(rest[0] in catalog[area])) added += 1;
    catalog[area][rest[0]] = values[language];
  }
  catalog.site = sort(catalog.site ?? {});
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`${Object.keys(entries).length} claves en 5 idiomas (${added} entradas nuevas).`);
