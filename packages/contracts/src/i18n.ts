import english from "./locales/en.json";
export type Locale = "es" | "en";
export const englishMessages: Record<string, string> = english;
export const supportedLocales: readonly Locale[] = ["es", "en"];
export function normalizeLocale(value?: string | null): Locale {
  return value?.toLowerCase().startsWith("en") ? "en" : "es";
}
/**
 * Idioma de una petición según su Host: inglés solo si coincide con el host de
 * SITE_URL_EN (o www.<host>). Cualquier otro host, incluido uno desconocido, es
 * español. Nunca se usa Accept-Language, ?lang= ni preferencias guardadas.
 */
export function localeForHost(
  host: string | null | undefined,
  siteUrlEn: string | null | undefined,
): Locale {
  const requested = hostname(host);
  let english = "";
  try {
    english = siteUrlEn ? new URL(siteUrlEn).hostname.toLowerCase() : "";
  } catch {
    english = "";
  }
  if (!requested || !english) return "es";
  return requested === english || requested === `www.${english}` ? "en" : "es";
}
function hostname(host: string | null | undefined): string {
  const value = (host || "").trim().toLowerCase();
  if (!value) return "";
  // IPv6 entre corchetes: [::1]:3087 → ::1
  if (value.startsWith("[")) return value.slice(1, value.indexOf("]"));
  return value.replace(/:\d+$/, "").replace(/\.$/, "");
}
/**
 * Rutas que cambian entre idiomas. El resto de rutas es igual en ambos dominios.
 * El gateway usa el mismo mapa para canonical, hreflang y sitemap.
 */
export const localizedPaths = {
  privacy: { es: "/privacidad", en: "/privacy" },
  terms: { es: "/condiciones", en: "/terms" },
} as const satisfies Record<string, Record<Locale, string>>;
export type LocalizedPage = keyof typeof localizedPaths;
/** Página traducida a la que corresponde una ruta, en cualquiera de sus idiomas. */
export function localizedPage(pathname: string): LocalizedPage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [page, paths] of Object.entries(localizedPaths))
    if (path === paths.es || path === paths.en) return page as LocalizedPage;
  return null;
}
/** La misma ruta en el idioma indicado: /privacy → /privacidad para es. */
export function translatePath(pathname: string, locale: Locale): string {
  const page = localizedPage(pathname);
  return page ? localizedPaths[page][locale] : pathname || "/";
}
/** Orígenes públicos de cada idioma, publicados por el gateway en el HTML. */
export type SiteOrigins = Record<Locale, string>;
/** Lee el contenido de <meta name="tuevento:sites">: "es=https://… en=https://…". */
export function parseSiteOrigins(content: string | null | undefined): SiteOrigins | null {
  if (!content) return null;
  const found: Partial<SiteOrigins> = {};
  for (const part of content.trim().split(/\s+/)) {
    const [key, value] = part.split("=", 2);
    if ((key === "es" || key === "en") && value) {
      try {
        const url = new URL(value);
        if (url.protocol === "https:" || url.protocol === "http:") found[key] = url.origin;
      } catch {}
    }
  }
  return found.es && found.en ? (found as SiteOrigins) : null;
}
/** Server-side translation for fixed messages; user content must never pass here. */
export function translateMessage(message: string, locale: Locale): string {
  return locale === "en" ? englishMessages[message] || message : message;
}
export function notificationMessage(
  counts: { accepted: number; declined: number; pending: number },
  locale: Locale,
): string {
  return locale === "en"
    ? `${counts.accepted} attending, ${counts.declined} not attending and ${counts.pending} pending.`
    : `${counts.accepted} ${counts.accepted === 1 ? "confirmado" : "confirmados"}, ${counts.declined} no ${counts.declined === 1 ? "asistirá" : "asistirán"} y ${counts.pending} en espera.`;
}
