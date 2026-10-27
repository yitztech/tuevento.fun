// Escribe en la salida estándar los idiomas y las rutas traducidas de packages/contracts,
// en un formato que 17-sites.sh lee con awk (la imagen de nginx no tiene Node):
//   default es
//   locale es
//   hosted pt en        (pt se sirve en el dominio de en, bajo /pt)
//   path privacy es /privacidad
//   section providers es /proveedores   (sección con páginas por debajo: /proveedores/<dirección>)
//   title es TuEventoFun · Invita, reúne y celebra
//   description es Crea invitaciones…
// Uso: node services/web/locales-manifest.cjs packages/contracts/dist > locales.txt
const { resolve } = require("node:path");
const {
  defaultLocale,
  supportedLocales,
  localizedPages,
  localizedPath,
  siteLocale,
  translate,
} = require(resolve(process.argv[2] || "packages/contracts/dist"));

const lines = [`default ${defaultLocale}`];
for (const locale of supportedLocales) {
  // Se insertan en nombres de variables de nginx y del shell
  if (!/^[a-z]{2,3}$/.test(locale)) throw new Error(`Código de idioma no válido: ${locale}`);
  lines.push(`locale ${locale}`);
}
for (const locale of supportedLocales)
  if (siteLocale(locale) !== locale) lines.push(`hosted ${locale} ${siteLocale(locale)}`);
for (const page of localizedPages)
  for (const locale of supportedLocales) {
    const path = localizedPath(page, locale);
    if (!/^\/[a-z0-9/-]*$/.test(path)) throw new Error(`Ruta no válida: ${path}`);
    lines.push(`path ${page} ${locale} ${path}`);
  }
for (const locale of supportedLocales) {
  const path = localizedPath("providers", locale);
  if (!/^\/[a-z]+$/.test(path)) throw new Error(`Ruta no válida: ${path}`);
  lines.push(`section providers ${locale} ${path}`);
}
// <title> y <meta name="description"> del HTML inicial en cada idioma (I18N-07). Se insertan
// entre comillas dobles en nginx y en el HTML: se escapan &, < y > y se rechaza lo que no cabe.
const html = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
for (const locale of supportedLocales)
  for (const [kind, key] of [["title", "landing.tueventofunInviteGatherCelebrate"], ["description", "common.metaDescription"]]) {
    const text = translate(locale, key);
    if (/["$\\\n{}]/.test(text)) throw new Error(`Texto SEO no válido (${locale} ${key}): ${text}`);
    lines.push(`${kind} ${locale} ${html(text)}`);
  }
process.stdout.write(`${lines.join("\n")}\n`);
