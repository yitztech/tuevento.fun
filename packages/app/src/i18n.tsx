import { Fragment, useEffect, type ReactElement } from "react";
import i18next from "i18next";
import { initReactI18next, Trans, useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Languages } from "lucide-react";
import {
  defaultLocale,
  isLocale,
  isMessageKey,
  locales,
  parseSiteOrigins,
  supportedLocales,
  translatePath,
  type Locale,
  type MessageKey,
  type MessageValues,
  type SiteOrigins,
} from "@tuevento/contracts";
const STORED_LOCALE = "tueventofun:app_locale";
/**
 * Un idioma por dominio: el gateway decide el idioma por el Host y lo escribe en
 * <html lang>. La SPA solo lo lee. Sin gateway (vite dev, app nativa) se usa el idioma
 * elegido en la app o, si no hay, el primero admitido del sistema.
 */
function documentLocale(): Locale {
  try {
    const hasSites = Boolean(document.querySelector('meta[name="tuevento:sites"]'));
    if (!hasSites) {
      const stored = localStorage.getItem(STORED_LOCALE);
      if (isLocale(stored)) return stored;
      const system = navigator.languages
        ?.map((tag) => tag.toLowerCase().split("-")[0])
        .find(isLocale);
      if (system) return system;
    }
    const lang = document.documentElement.lang;
    return isLocale(lang) ? lang : defaultLocale;
  } catch {
    return defaultLocale;
  }
}
export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: documentLocale(),
  fallbackLng: defaultLocale,
  supportedLngs: supportedLocales,
  resources: Object.fromEntries(
    supportedLocales.map((locale) => [locale, { translation: locales[locale].messages }]),
  ),
  // Las claves son rutas con punto; ":" nunca separa namespaces
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});
export const getLocale = (): Locale => {
  const active = i18n.resolvedLanguage ?? i18n.language;
  return isLocale(active) ? active : defaultLocale;
};
/** Locale de Intl del idioma activo (fechas y números). */
export const formatLocale = () => locales[getLocale()].intl;
/** Texto de una clave del catálogo. Los plurales se piden por su base con `count`. */
export const tr = (key: MessageKey, values?: MessageValues): string =>
  String(i18n.t(key, values));
/**
 * Mensaje que llega como texto: una clave (validaciones de Zod) o un texto ya traducido
 * por la API. Solo se traduce si es una clave; lo demás se muestra tal cual.
 */
export const trMessage = (message: string): string =>
  isMessageKey(message) ? tr(message) : message;
/**
 * Texto con saltos de línea marcados con \n en el catálogo: cada idioma decide dónde
 * cortar sus titulares.
 */
export function Lines({ k }: { k: MessageKey }) {
  return (
    <>
      {tr(k)
        .split("\n")
        .map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
    </>
  );
}
/**
 * Texto con partes marcadas (<strong>…</strong>, <terms>…</terms>) que se sustituyen
 * por elementos. El orden de las partes lo decide cada idioma.
 */
export function RichText({
  k,
  values,
  components,
}: {
  k: MessageKey;
  values?: MessageValues;
  components: Record<string, ReactElement>;
}) {
  useLocale();
  const key: string = k;
  return <Trans i18n={i18n} i18nKey={key} values={values} components={components} />;
}
export function useLocale() {
  const { i18n: active } = useTranslation(undefined, { i18n });
  const lang = active.resolvedLanguage;
  return { locale: isLocale(lang) ? lang : defaultLocale };
}
/** Cambia el idioma en apps móviles o entornos sin gateway de dominios. */
export function switchAppLocale(target: Locale) {
  try {
    localStorage.setItem(STORED_LOCALE, target);
    document.documentElement.lang = target;
  } catch {}
  void i18n.changeLanguage(target);
}
/** Orígenes de cada idioma que publica el gateway en <meta name="tuevento:sites">. */
export function siteOrigins(): SiteOrigins | null {
  try {
    return parseSiteOrigins(
      document.querySelector('meta[name="tuevento:sites"]')?.getAttribute("content"),
    );
  } catch {
    return null;
  }
}
/**
 * Enlaces al mismo contenido en el dominio de cada otro idioma (web) o botones de cambio
 * (app móvil). Con un solo idioma más es un enlace directo; con varios, un menú.
 */
export function LanguageSwitcher() {
  const { locale } = useLocale();
  const { pathname, search, hash } = useLocation();
  const sites = siteOrigins();
  const others = (sites ? (Object.keys(sites) as Locale[]) : supportedLocales).filter(
    (other) => other !== locale,
  );
  if (!others.length) return null;
  const option = (other: Locale) => {
    const content = (
      <>
        <Languages size={16} aria-hidden="true" />
        <span className="language-switcher-label">{locales[other].name}</span>
      </>
    );
    return sites ? (
      <a
        key={other}
        className="language-switcher"
        href={`${sites[other]}${translatePath(pathname, other)}${search}${hash}`}
        hrefLang={other}
        lang={other}
        title={tr("language.changeLanguage")}
      >
        {content}
      </a>
    ) : (
      <button
        key={other}
        type="button"
        className="language-switcher"
        lang={other}
        onClick={() => switchAppLocale(other)}
        title={tr("language.changeLanguage")}
        aria-label={`${tr("language.changeLanguage")}: ${locales[other].name}`}
      >
        {content}
      </button>
    );
  };
  if (others.length === 1) return option(others[0]);
  return (
    <details className="language-menu">
      <summary className="language-switcher" title={tr("language.changeLanguage")}>
        <Languages size={16} aria-hidden="true" />
        <span className="language-switcher-label">{locales[locale].name}</span>
      </summary>
      <div className="language-menu-list">{others.map(option)}</div>
    </details>
  );
}
/**
 * Mantiene canonical y hreflang al navegar sin recargar, con las mismas reglas
 * que el gateway: ruta del idioma del dominio, sin query, y x-default en el principal.
 */
export function SeoLinks() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  useEffect(() => {
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", tr("common.metaDescription"));
    const sites = siteOrigins();
    if (!sites) return;
    const url = (target: Locale) => `${sites[target]}${translatePath(pathname, target)}`;
    const set = (selector: string, href: string) =>
      document.querySelector(selector)?.setAttribute("href", href);
    set('link[rel="canonical"]', url(locale));
    for (const target of Object.keys(sites) as Locale[])
      set(`link[rel="alternate"][hreflang="${target}"]`, url(target));
    set('link[rel="alternate"][hreflang="x-default"]', url(defaultLocale));
  }, [pathname, locale]);
  return null;
}
