import { localeForHost, type Locale } from "@tuevento/contracts";
type WithHost = { headers: { host?: string | string[] } };
/**
 * Idioma de la petición según el Host que fija el gateway (proxy_set_header Host
 * $host). Se ignoran Accept-Language, ?lang= y cualquier preferencia del cliente.
 */
export function requestLocale(req?: WithHost | null): Locale {
  const host = req?.headers.host;
  return localeForHost(
    Array.isArray(host) ? host[0] : host,
    process.env.SITE_URL_EN,
  );
}
