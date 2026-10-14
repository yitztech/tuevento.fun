import { localeForHost, type Locale } from "@tuevento/contracts";
type WithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};
/**
 * Idioma de la petición según el Host que fija el gateway (proxy_set_header Host
 * $host). Para clientes móviles nativos (X-Client-Platform: android/ios), se respeta
 * también X-App-Locale para permitir apps móviles bilingües.
 */
export function requestLocale(req?: WithHeaders | null): Locale {
  const host = req?.headers?.host;
  const hostLoc = localeForHost(
    Array.isArray(host) ? host[0] : host,
    process.env.SITE_URL_EN,
  );
  if (hostLoc === "en") return "en";
  const platform = req?.headers?.["x-client-platform"];
  const appLocale = req?.headers?.["x-app-locale"];
  if (
    (platform === "android" || platform === "ios") &&
    appLocale === "en"
  ) {
    return "en";
  }
  return "es";
}
