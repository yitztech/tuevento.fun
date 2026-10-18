import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Mismas claves, mismas variables y ningún texto vacío en los cinco idiomas del panel.
const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/i18n");
const LANGS = ["es", "en", "pt", "de", "fr"];
const dicts = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(join(dir, `${l}.json`), "utf8"))]));
const variables = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");

test("los cinco idiomas tienen exactamente las mismas claves", () => {
  const keys = Object.keys(dicts.es).sort();
  for (const lang of LANGS) assert.deepEqual(Object.keys(dicts[lang]).sort(), keys, lang);
});

test("cada texto tiene las mismas variables que en español y ninguno está vacío", () => {
  for (const [key, spanish] of Object.entries(dicts.es)) {
    for (const lang of LANGS) {
      assert.ok(dicts[lang][key]?.trim(), `${lang} ${key} vacío`);
      assert.equal(variables(dicts[lang][key]), variables(spanish), `${lang} ${key}`);
    }
  }
});
