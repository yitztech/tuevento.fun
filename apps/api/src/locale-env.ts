import { defaultLocale, localePrefix, siteLocale, type Locale } from "@tuevento/contracts";
/**
 * Variable de entorno del dominio de un idioma, según el contrato de la plataforma:
 * `NAME_<IDIOMA>` (`SITE_URL_EN`); para el idioma principal vale también `NAME` sin sufijo.
 * Un idioma alojado en otro dominio (pt en yourevent.fun) usa las de ese dominio.
 */
export function localeEnv(name: string, locale: Locale): string {
  const domain = siteLocale(locale);
  const suffixed = process.env[localeEnvName(name, domain)];
  if (suffixed) return suffixed;
  return domain === defaultLocale ? process.env[name] || "" : "";
}
/** Nombre de la variable de un idioma: `MAIL_FROM_EN`; en los avisos, `MAIL_FROM_ES (o MAIL_FROM)`. */
export const localeEnvName = (name: string, locale: Locale, alias = false) => {
  const domain = siteLocale(locale);
  return `${name}_${domain.toUpperCase()}${alias && domain === defaultLocale ? ` (o ${name})` : ""}`;
};
/** Origen público del idioma, con su prefijo si vive en otro dominio, sin barra final. */
export function siteUrl(locale: Locale): string {
  return localeEnv("SITE_URL", locale).replace(/\/+$/, "") + localePrefix(locale);
}
