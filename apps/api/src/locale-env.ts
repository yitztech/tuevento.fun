import type { Locale } from "@tuevento/contracts";
/**
 * Variable de entorno por idioma, según el contrato de la plataforma: `NAME_EN` para
 * inglés; para español, `NAME_ES` o `NAME` sin sufijo (el idioma principal).
 */
export function localeEnv(name: string, locale: Locale): string {
  const suffixed = process.env[`${name}_${locale.toUpperCase()}`];
  if (suffixed) return suffixed;
  return locale === "es" ? process.env[name] || "" : "";
}
/** Origen público del dominio de cada idioma, sin barra final. */
export function siteUrl(locale: Locale): string {
  return localeEnv("SITE_URL", locale).replace(/\/+$/, "");
}
