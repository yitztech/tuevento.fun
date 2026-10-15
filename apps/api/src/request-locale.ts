import {
  defaultLocale,
  isLocale,
  localeForHost,
  siteOriginsFromEnv,
  type Locale,
} from "@tuevento/contracts";
type WithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};
/** Dominio de cada idioma (`SITE_URL_<IDIOMA>`); se lee una vez al arrancar. */
const origins = siteOriginsFromEnv(process.env);
/**
 * Idioma de la petición según el Host que fija el gateway (proxy_set_header Host
 * $host). Las apps móviles usan un único dominio, el principal: para ellas
 * (X-Client-Platform: android/ios) vale también X-App-Locale, el idioma elegido en la app.
 */
export function requestLocale(req?: WithHeaders | null): Locale {
  const host = req?.headers?.host;
  const hostLocale = localeForHost(Array.isArray(host) ? host[0] : host, origins);
  if (hostLocale !== defaultLocale) return hostLocale;
  const platform = req?.headers?.["x-client-platform"];
  const appLocale = req?.headers?.["x-app-locale"];
  if ((platform === "android" || platform === "ios") && isLocale(appLocale)) return appLocale;
  return defaultLocale;
}
