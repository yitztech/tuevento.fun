// Escribe en la salida estándar los idiomas y las rutas traducidas de packages/contracts,
// en un formato que 17-sites.sh lee con awk (la imagen de nginx no tiene Node):
//   default es
//   locale es
//   path privacy es /privacidad
// Uso: node services/web/locales-manifest.cjs packages/contracts/dist > locales.txt
const { resolve } = require("node:path");
const {
  defaultLocale,
  supportedLocales,
  localizedPages,
  localizedPath,
} = require(resolve(process.argv[2] || "packages/contracts/dist"));

const lines = [`default ${defaultLocale}`];
for (const locale of supportedLocales) {
  // Se insertan en nombres de variables de nginx y del shell
  if (!/^[a-z]{2,3}$/.test(locale)) throw new Error(`Código de idioma no válido: ${locale}`);
  lines.push(`locale ${locale}`);
}
for (const page of localizedPages)
  for (const locale of supportedLocales) {
    const path = localizedPath(page, locale);
    if (!/^\/[a-z0-9/-]*$/.test(path)) throw new Error(`Ruta no válida: ${path}`);
    lines.push(`path ${page} ${locale} ${path}`);
  }
process.stdout.write(`${lines.join("\n")}\n`);
