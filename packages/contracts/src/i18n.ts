import { z } from "zod";
import es from "./locales/es.json";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";

/** Estructura de un catálogo: la del idioma principal. Las demás deben tener las mismas claves. */
export type Catalog = typeof es;
/** Páginas cuya ruta cambia con el idioma. El resto de rutas es igual en todos los dominios. */
export type LocalizedPage = "privacy" | "terms";
type LocaleConfig = {
  /** Nombre del idioma en ese mismo idioma, para el selector. */
  name: string;
  /** Locale de Intl para fechas, números y reglas de plural. */
  intl: string;
  /** Mensajes genéricos de Zod en ese idioma. */
  zod: keyof typeof z.locales;
  paths: Record<LocalizedPage, string>;
  messages: Catalog;
  /**
   * Idioma con dominio propio que sirve a este bajo el prefijo /<código>
   * (yourevent.fun/pt/…). Sin él, el idioma tiene su propio dominio.
   */
  hostedBy?: string;
};

/**
 * Idiomas disponibles: la única lista que hay que tocar para añadir uno (ver docs/I18N.md).
 * Un idioma tiene su dominio en `SITE_URL_<CÓDIGO>` o vive en el de otro bajo /<código>
 * (`hostedBy`); el gateway, la API y la SPA se generan a partir de esta tabla.
 */
export const locales = {
  es: {
    name: "Español",
    intl: "es-MX",
    zod: "es",
    paths: { privacy: "/privacidad", terms: "/condiciones" },
    messages: es,
  },
  en: {
    name: "English",
    intl: "en-US",
    zod: "en",
    paths: { privacy: "/privacy", terms: "/terms" },
    messages: en,
  },
  pt: {
    name: "Português",
    intl: "pt-BR",
    zod: "pt",
    paths: { privacy: "/privacidade", terms: "/termos" },
    messages: pt,
    hostedBy: "en",
  },
  de: {
    name: "Deutsch",
    intl: "de-DE",
    zod: "de",
    paths: { privacy: "/datenschutz", terms: "/nutzungsbedingungen" },
    messages: de,
    hostedBy: "en",
  },
  fr: {
    name: "Français",
    intl: "fr-FR",
    zod: "fr",
    paths: { privacy: "/confidentialite", terms: "/conditions" },
    messages: fr,
    hostedBy: "en",
  },
} as const satisfies Record<string, LocaleConfig>;
export type Locale = keyof typeof locales;
/** Idioma principal: el de un Host desconocido y el fallback de cualquier texto que falte. */
export const defaultLocale: Locale = "es";
export const supportedLocales = Object.keys(locales) as Locale[];
export const localizedPages: readonly LocalizedPage[] = ["privacy", "terms"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(locales, value);
}
/** Idioma dueño del dominio en el que se sirve `locale` (él mismo si tiene dominio propio). */
export function siteLocale(locale: Locale): Locale {
  const host = (locales[locale] as LocaleConfig).hostedBy;
  return isLocale(host) ? host : locale;
}
/** Idiomas con dominio propio, el principal primero. */
export const domainLocales = supportedLocales.filter((locale) => siteLocale(locale) === locale);
/** Idiomas que se sirven en el dominio de `domain`: él mismo y los que aloja. */
export const localesOfSite = (domain: Locale) =>
  supportedLocales.filter((locale) => siteLocale(locale) === domain);
/** Prefijo de ruta de un idioma: "" con dominio propio, "/pt" si vive en otro dominio. */
export const localePrefix = (locale: Locale): string =>
  siteLocale(locale) === locale ? "" : `/${locale}`;
/**
 * Idioma alojado al que pertenece una ruta (/pt, /pt/…) y la ruta sin el prefijo, o null
 * si la ruta no empieza por el prefijo de ningún idioma alojado.
 */
export function prefixedLocale(pathname: string): { locale: Locale; path: string } | null {
  for (const locale of supportedLocales) {
    const prefix = localePrefix(locale);
    if (!prefix) continue;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`))
      return { locale, path: pathname.slice(prefix.length) || "/" };
  }
  return null;
}
/** Etiqueta de idioma ("en-GB", "pt_BR,pt;q=0.9") → idioma admitido; si no hay, el principal. */
export function normalizeLocale(value?: string | null): Locale {
  const code = value?.trim().toLowerCase().split(/[-_,;]/)[0];
  return isLocale(code) ? code : defaultLocale;
}

// ── Claves de mensajes ──────────────────────────────────────────────
type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K extends `${infer Base}_${PluralSuffix}` ? Base : K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
/**
 * Claves válidas del catálogo ("account.signIn"). Los plurales se piden por su base
 * ("notifications.accepted") con `count`; el sufijo (_one, _other…) lo elige Intl.PluralRules.
 */
export type MessageKey = Leaves<Catalog>;
export type MessageValues = Record<string, string | number>;

function flatten(node: object, prefix = "", into = new Map<string, string>()) {
  for (const [key, value] of Object.entries(node))
    if (typeof value === "string") into.set(prefix + key, value);
    else flatten(value, `${prefix}${key}.`, into);
  return into;
}
const flat = Object.fromEntries(
  supportedLocales.map((locale) => [locale, flatten(locales[locale].messages)]),
) as Record<Locale, Map<string, string>>;
/** Todas las claves del catálogo de un idioma, con sufijos de plural. */
export const catalogKeys = (locale: Locale) => [...flat[locale].keys()];

function lookup(locale: Locale, key: string, count: unknown) {
  const messages = flat[locale];
  if (typeof count === "number") {
    const category = new Intl.PluralRules(locales[locale].intl).select(count);
    const plural = messages.get(`${key}_${category}`) ?? messages.get(`${key}_other`);
    if (plural !== undefined) return plural;
  }
  return messages.get(key);
}
const interpolate = (template: string, values?: MessageValues) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    values && name in values ? String(values[name]) : match,
  );

/** Texto de una clave en un idioma (con el principal como respaldo). Para el servidor. */
export function translate(locale: Locale, key: MessageKey, values?: MessageValues): string {
  const template =
    lookup(locale, key, values?.count) ?? lookup(defaultLocale, key, values?.count) ?? key;
  return interpolate(template, values);
}
/** ¿Es `value` una clave del catálogo? (para mensajes que llegan como texto). */
export function isMessageKey(value: string): value is MessageKey {
  return flat[defaultLocale].has(value) || flat[defaultLocale].has(`${value}_other`);
}
/**
 * Traduce un mensaje fijo que puede ser una clave (errores de la API, validaciones).
 * Cualquier otro texto, como el contenido de los usuarios, se devuelve intacto.
 */
export function translateMessage(message: string, locale: Locale): string {
  return isMessageKey(message) ? translate(locale, message) : message;
}

// ── Idioma por dominio ──────────────────────────────────────────────
/** Origen público (https://host) de cada idioma que tiene dominio propio. */
export type SiteOrigins = Partial<Record<Locale, string>>;

/**
 * Orígenes de cada idioma según el entorno: `SITE_URL_<CÓDIGO>` y, para el principal,
 * también `SITE_URL` sin sufijo (contrato de la plataforma). Los que no son una URL se ignoran.
 */
export function siteOriginsFromEnv(env: Record<string, string | undefined>): SiteOrigins {
  const found: SiteOrigins = {};
  for (const locale of domainLocales) {
    const value =
      env[`SITE_URL_${locale.toUpperCase()}`] ||
      (locale === defaultLocale ? env.SITE_URL : undefined);
    const origin = httpOrigin(value);
    if (origin) found[locale] = origin;
  }
  return found;
}
function httpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Idioma de una petición según su Host: el idioma cuyo dominio (o www.<dominio>) coincide.
 * Cualquier otro Host, incluido uno desconocido, es el principal. Nunca se usa
 * Accept-Language, ?lang= ni preferencias guardadas.
 */
export function localeForHost(host: string | null | undefined, origins: SiteOrigins): Locale {
  const requested = hostname(host);
  if (!requested) return defaultLocale;
  for (const locale of domainLocales) {
    if (locale === defaultLocale) continue;
    const origin = origins[locale];
    if (!origin) continue;
    const own = new URL(origin).hostname.toLowerCase();
    if (requested === own || requested === `www.${own}`) return locale;
  }
  return defaultLocale;
}
function hostname(host: string | null | undefined): string {
  const value = (host || "").trim().toLowerCase();
  if (!value) return "";
  // IPv6 entre corchetes: [::1]:3087 → ::1
  if (value.startsWith("[")) return value.slice(1, value.indexOf("]"));
  return value.replace(/:\d+$/, "").replace(/\.$/, "");
}

/**
 * Idioma de una petición a la API: el del dominio (Host) o, si la SPA indica en
 * X-App-Locale un idioma que ese dominio aloja (yourevent.fun/pt), ese. Las apps móviles
 * usan solo el dominio principal y pueden pedir cualquier idioma.
 */
export function localeForRequest(
  host: string | null | undefined,
  appLocale: unknown,
  mobile: boolean,
  origins: SiteOrigins,
): Locale {
  const domain = localeForHost(host, origins);
  if (!isLocale(appLocale)) return domain;
  if (siteLocale(appLocale) === domain) return appLocale;
  return mobile && domain === defaultLocale ? appLocale : domain;
}

/** Ruta de una página traducida en un idioma. */
export const localizedPath = (page: LocalizedPage, locale: Locale): string =>
  locales[locale].paths[page];
/** Página traducida a la que corresponde una ruta, en cualquiera de sus idiomas. */
export function localizedPage(pathname: string): LocalizedPage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const page of localizedPages)
    if (supportedLocales.some((locale) => localizedPath(page, locale) === path)) return page;
  return null;
}
/** La misma ruta en el idioma indicado: /privacy → /privacidad para es. */
export function translatePath(pathname: string, locale: Locale): string {
  const page = localizedPage(pathname);
  return page ? localizedPath(page, locale) : pathname || "/";
}

/**
 * URL pública de una ruta en un idioma: dominio de su sitio, prefijo y ruta traducida
 * (/privacy → https://yourevent.fun/pt/privacidade). null si ese dominio no se publica.
 */
export function localeUrl(locale: Locale, pathname: string, origins: SiteOrigins): string | null {
  const origin = origins[siteLocale(locale)];
  if (!origin) return null;
  const path = translatePath(pathname, locale);
  const prefix = localePrefix(locale);
  return `${origin}${prefix && path === "/" ? `${prefix}/` : `${prefix}${path}`}`;
}

/**
 * Lee el contenido de <meta name="tuevento:sites">, que publica el gateway:
 * "es=https://… en=https://…". Solo idiomas admitidos y orígenes http(s). Sin el
 * principal y al menos otro idioma no hay a dónde cambiar: devuelve null.
 */
export function parseSiteOrigins(content: string | null | undefined): SiteOrigins | null {
  if (!content) return null;
  const found: SiteOrigins = {};
  for (const part of content.trim().split(/\s+/)) {
    const [key, value] = part.split("=", 2);
    const origin = httpOrigin(value);
    if (isLocale(key) && siteLocale(key) === key && origin) found[key] = origin;
  }
  return found[defaultLocale] && Object.keys(found).length > 1 ? found : null;
}

/** Errores genéricos de Zod en el idioma de cada parse, sin cambiar el locale global. */
export const validationOptions = (locale: Locale) => ({
  error: z.locales[locales[locale].zod]().localeError,
});

/** Resumen de una respuesta a partir de sus cantidades: el texto se arma en cada idioma. */
export function notificationMessage(
  counts: { accepted: number; declined: number; pending: number },
  locale: Locale,
): string {
  return translate(locale, "notifications.summary", {
    accepted: translate(locale, "notifications.accepted", { count: counts.accepted }),
    declined: translate(locale, "notifications.declined", { count: counts.declined }),
    pending: translate(locale, "notifications.pending", { count: counts.pending }),
  });
}
