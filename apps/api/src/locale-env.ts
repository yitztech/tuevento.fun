import { defaultLocale, type Locale } from "@tuevento/contracts";
/**
 * Variable de entorno por idioma, según el contrato de la plataforma: `NAME_<IDIOMA>`
 * (`SITE_URL_EN`); para el idioma principal vale también `NAME` sin sufijo.
 */
export function localeEnv(name: string, locale: Locale): string {
  const suffixed = process.env[localeEnvName(name, locale)];
  if (suffixed) return suffixed;
  return locale === defaultLocale ? process.env[name] || "" : "";
}
/** Nombre de la variable de un idioma: `MAIL_FROM_EN`; en los avisos, `MAIL_FROM_ES (o MAIL_FROM)`. */
export const localeEnvName = (name: string, locale: Locale, alias = false) =>
  `${name}_${locale.toUpperCase()}${alias && locale === defaultLocale ? ` (o ${name})` : ""}`;
/** Origen público del dominio de cada idioma, sin barra final. */
export function siteUrl(locale: Locale): string {
  return localeEnv("SITE_URL", locale).replace(/\/+$/, "");
}
