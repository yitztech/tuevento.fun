import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { catalogKeys, defaultLocale, locales, supportedLocales, type Locale } from "./index";

const plural = /_(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(plural, "");
const messages = (locale: Locale) => {
  const flat = new Map<string, string>();
  const walk = (node: object, prefix: string) => {
    for (const [key, value] of Object.entries(node))
      if (typeof value === "string") flat.set(prefix + key, value);
      else walk(value, `${prefix}${key}.`);
  };
  walk(locales[locale].messages, "");
  return flat;
};
const variables = (text: string) =>
  [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort();
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

test("Cada idioma tiene las mismas claves que el principal", () => {
  const expected = new Set(catalogKeys(defaultLocale).map(base));
  for (const locale of supportedLocales) {
    const actual = new Set(catalogKeys(locale).map(base));
    assert.deepEqual(
      [...expected].filter((key) => !actual.has(key)),
      [],
      `${locale}: faltan claves`,
    );
    assert.deepEqual(
      [...actual].filter((key) => !expected.has(key)),
      [],
      `${locale}: sobran claves`,
    );
  }
});

test("Los plurales tienen las categorías que exige cada idioma", () => {
  for (const locale of supportedLocales) {
    const keys = catalogKeys(locale);
    const bases = new Set(keys.filter((key) => plural.test(key)).map(base));
    // Categorías que aparecen con cantidades reales (0–1000): el polaco necesita few y
    // many; el "many" del español solo aplica a millones exactos y cae en _other.
    const rules = new Intl.PluralRules(locales[locale].intl);
    const categories = new Set(Array.from({ length: 1001 }, (_, n) => rules.select(n)));
    for (const key of bases)
      for (const category of categories)
        assert.ok(keys.includes(`${key}_${category}`), `${locale}: falta ${key}_${category}`);
  }
});

test("Las traducciones conservan las variables y las marcas de cada mensaje", () => {
  const reference = messages(defaultLocale);
  const byBase = (map: Map<string, string>) => {
    const result = new Map<string, { vars: string[]; tags: string[] }>();
    for (const [key, text] of map) {
      const entry = result.get(base(key)) ?? { vars: [], tags: [] };
      entry.vars = [...new Set([...entry.vars, ...variables(text)])].sort();
      entry.tags = tags(text);
      result.set(base(key), entry);
    }
    return result;
  };
  const expected = byBase(reference);
  for (const locale of supportedLocales)
    for (const [key, entry] of byBase(messages(locale))) {
      assert.deepEqual(entry.vars, expected.get(key)?.vars, `${locale}: variables de ${key}`);
      assert.deepEqual(entry.tags, expected.get(key)?.tags, `${locale}: marcas de ${key}`);
    }
});

test("Ningún mensaje queda vacío ni sin traducir por error", () => {
  for (const locale of supportedLocales)
    for (const [key, text] of messages(locale))
      assert.ok(text.trim(), `${locale}: ${key} está vacío`);
});

// Las claves se escriben siempre completas en el código ("account.signIn"), nunca
// armadas por partes: así se pueden buscar y esta prueba detecta las que sobran o faltan.
const root = join(__dirname, "../../..");
// services/search: el servicio de búsqueda en Go usa las claves desde shared.json
const sourceDirs = ["packages/app/src", "packages/contracts/src", "packages/client/src", "apps/api/src", "apps/web/src", "services/search"];
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|go)$/.test(name) && !/(\.test\.ts|_test\.go)$/.test(name) ? [path] : [];
  });
}
const code = sourceDirs.flatMap((dir) => sources(join(root, dir))).map((file) => readFileSync(file, "utf8"));

test("Toda clave del catálogo se usa en el código", () => {
  const all = code.join("\n");
  const unused = [...new Set(catalogKeys(defaultLocale).map(base))].filter(
    (key) => !all.includes(`"${key}"`) && !all.includes(`'${key}'`),
  );
  assert.deepEqual(unused, []);
});

test("Toda clave citada en el código existe en el catálogo", () => {
  const known = new Set(catalogKeys(defaultLocale).map(base));
  const namespaces = Object.keys(locales[defaultLocale].messages).join("|");
  // Un prefijo para componer claves ("providers.categories." + código) termina en punto: no es una clave
  const pattern = new RegExp(`["'\`]((?:${namespaces})\\.[A-Za-z0-9.]*[A-Za-z0-9])["'\`]`, "g");
  const missing = new Set<string>();
  for (const text of code)
    for (const [, key] of text.matchAll(pattern)) if (!known.has(key)) missing.add(key);
  assert.deepEqual([...missing], []);
});
