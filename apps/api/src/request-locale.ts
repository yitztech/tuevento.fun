import { localeForRequest, siteOriginsFromEnv, type Locale } from "@tuevento/contracts";
type WithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};
/** Dominio de cada idioma (`SITE_URL_<IDIOMA>`); se lee una vez al arrancar. */
const origins = siteOriginsFromEnv(process.env);
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
/**
 * Idioma de la petición según el Host que fija el gateway (proxy_set_header Host
 * $host). La SPA indica en X-App-Locale el idioma de la página: vale si el dominio lo
 * aloja (yourevent.fun/pt → pt). Las apps móviles (X-Client-Platform: android/ios) usan
 * solo el dominio principal y pueden pedir cualquier idioma.
 */
export function requestLocale(req?: WithHeaders | null): Locale {
  const platform = first(req?.headers?.["x-client-platform"]);
  return localeForRequest(
    first(req?.headers?.host),
    first(req?.headers?.["x-app-locale"]),
    platform === "android" || platform === "ios",
    origins,
  );
}
