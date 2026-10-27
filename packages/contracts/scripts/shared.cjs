// Escribe dist/shared.json: lo que el servicio de búsqueda en Go (services/search) toma de esta
// tabla única — idiomas, límites, categorías, estados de error y los textos que responde —, y lo
// copia a services/search/internal/catalog/ para embeberlo (go:embed). No se versiona.
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const c = require("../dist");

const prefixes = ["problems.", "search.", "providers.categories.", "validation.invalidCoordinates", "validation.invalidCategory", "errors.tooManyAttemptsPlease"];
function flatten(object, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else flatten(value, path, out);
  }
  return out;
}
const shared = {
  defaultLocale: c.defaultLocale,
  locales: c.supportedLocales.map((code) => ({ code, hostedBy: c.locales[code].hostedBy ?? null })),
  accountLimits: { search: c.accountLimits.search },
  searchLimits: c.searchLimits,
  searchSorts: c.searchSorts,
  providerCategories: c.providerCategories,
  problemStatuses: c.problemStatuses,
  messages: Object.fromEntries(
    c.supportedLocales.map((code) => [
      code,
      Object.fromEntries(Object.entries(flatten(c.locales[code].messages)).filter(([key]) => prefixes.some((p) => key.startsWith(p)))),
    ]),
  ),
};
const text = `${JSON.stringify(shared, null, 2)}\n`;
writeFileSync(join(__dirname, "../dist/shared.json"), text);
const target = join(__dirname, "../../../services/search/internal/catalog");
mkdirSync(target, { recursive: true });
writeFileSync(join(target, "shared.json"), text);
