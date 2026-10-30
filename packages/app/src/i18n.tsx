import { Fragment, useEffect, useState, type MouseEvent, type ReactElement } from "react";
import i18next from "i18next";
import { initReactI18next, Trans, useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { LocaleFlag } from "./locale-flags";
import {
  defaultLocale,
  isLocale,
  isMessageKey,
  localePrefix,
  locales,
  localeUrl,
  parseSiteOrigins,
  prefixedLocale,
  siteLocale,
  supportedLocales,
  translatePath,
  type Locale,
  type MessageKey,
  type MessageValues,
  type SiteOrigins,
} from "@tuevento/contracts";
import { Button } from "./ui/button";
const STORED_LOCALE = "tueventofun:app_locale";
const SUGGESTION_DISMISSED = "tueventofun:language_suggestion";
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
const sites = siteOrigins();
/**
 * Idioma dueño del dominio de esta página (web con gateway). Lo decide el Host: el
 * gateway lo escribe en <html lang> (o el de un idioma que el dominio aloja).
 */
const pageDomain: Locale | null = (() => {
  if (!sites) return null;
  try {
    const lang = document.documentElement.lang;
    return siteLocale(isLocale(lang) ? lang : defaultLocale);
  } catch {
    return defaultLocale;
  }
})();
/** Idioma de una ruta en el dominio de esta página: /pt/… → pt si el dominio lo aloja. */
function localeOfPath(pathname: string, domain: Locale): Locale {
  const prefixed = prefixedLocale(pathname);
  return prefixed && siteLocale(prefixed.locale) === domain ? prefixed.locale : domain;
}
/**
 * Un dominio por idioma; los idiomas alojados en un dominio (yourevent.fun/pt) llevan
 * su prefijo en la ruta. En web el idioma sale del dominio y la ruta. Sin gateway (vite
 * dev, app nativa) se usa el idioma elegido en la app o, si no hay, el primero
 * admitido del sistema.
 */
function documentLocale(): Locale {
  try {
    if (pageDomain) return localeOfPath(window.location.pathname, pageDomain);
    const stored = localStorage.getItem(STORED_LOCALE);
    if (isLocale(stored)) return stored;
    const system = navigator.languages
      ?.map((tag) => tag.toLowerCase().split("-")[0])
      .find(isLocale);
    if (system) return system;
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
/** Prefijo de ruta del idioma activo en web ("/pt" en yourevent.fun/pt); "" sin gateway. */
export const pathPrefix = (locale: Locale = getLocale()): string =>
  pageDomain ? localePrefix(locale) : "";
/** Prefijo de ruta del idioma activo; cambia al cambiar de idioma sin recargar. */
export function usePathPrefix() {
  const { locale } = useLocale();
  return pathPrefix(locale);
}
function applyLocale(target: Locale) {
  try {
    document.documentElement.lang = target;
  } catch {}
  void i18n.changeLanguage(target);
}
/** Cambia el idioma en apps móviles o entornos sin gateway de dominios. */
export function switchAppLocale(target: Locale) {
  try {
    localStorage.setItem(STORED_LOCALE, target);
  } catch {}
  applyLocale(target);
}
/** ¿Se puede pasar a `target` sin salir de este dominio? (en ↔ pt ↔ de en yourevent.fun) */
const inPlace = (target: Locale) => pageDomain !== null && siteLocale(target) === pageDomain;
/**
 * Pasa a otro idioma del mismo dominio sin recargar: cambia la URL al prefijo del idioma
 * (con la ruta traducida) y la interfaz. El router se vuelve a montar con su nueva base.
 */
function switchPageLocale(target: Locale) {
  const { pathname, search, hash } = window.location;
  const current = prefixedLocale(pathname)?.path ?? pathname;
  const path = translatePath(current, target);
  const prefix = localePrefix(target);
  const url = `${prefix && path === "/" ? `${prefix}/` : `${prefix}${path}`}${search}${hash}`;
  window.history.pushState(null, "", url);
  applyLocale(target);
}
// Atrás y adelante entre /, /pt y /de: el idioma sigue a la URL
if (pageDomain)
  window.addEventListener("popstate", () => {
    const target = localeOfPath(window.location.pathname, pageDomain);
    if (target !== getLocale()) applyLocale(target);
  });
function rememberChoice() {
  try {
    localStorage.setItem(SUGGESTION_DISMISSED, "1");
  } catch {}
}
/** Idiomas a los que se puede pasar desde esta página. */
function reachableLocales(): Locale[] {
  return supportedLocales.filter((locale) => !sites || Boolean(sites[siteLocale(locale)]));
}
/** URL de la página actual en otro idioma (otro dominio o su prefijo). */
const otherUrl = (target: Locale, pathname: string, search: string, hash: string) =>
  `${localeUrl(target, pathname, sites ?? {}) ?? ""}${search}${hash}`;
/**
 * Selector de idioma. En web: los idiomas del mismo dominio (en, pt, de en
 * yourevent.fun) cambian la interfaz sin recargar; los de otro dominio son enlaces a la
 * misma página allí. En apps móviles, botones. Con un solo idioma más es un enlace o
 * botón directo; con varios, un menú.
 */
export function LanguageSwitcher() {
  const { locale } = useLocale();
  const { pathname, search, hash } = useLocation();
  const others = reachableLocales().filter((other) => other !== locale);
  if (!others.length) return null;
  const choose = (other: Locale) => (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
    rememberChoice();
    if (!sites) switchAppLocale(other);
    else if (inPlace(other)) {
      event.preventDefault();
      switchPageLocale(other);
    }
  };
  // Se ve solo la bandera; el nombre completo queda en el nombre accesible
  const label = (target: Locale) => `${tr("language.changeLanguage")}: ${locales[target].name}`;
  const content = (target: Locale) => <LocaleFlag locale={target} />;
  const option = (other: Locale) => {
    return sites ? (
      <a
        key={other}
        className="language-switcher"
        href={otherUrl(other, pathname, search, hash)}
        hrefLang={other}
        lang={other}
        title={locales[other].name}
        aria-label={label(other)}
        onClick={choose(other)}
      >
        {content(other)}
      </a>
    ) : (
      <button
        key={other}
        type="button"
        className="language-switcher"
        lang={other}
        onClick={choose(other)}
        title={locales[other].name}
        aria-label={label(other)}
      >
        {content(other)}
      </button>
    );
  };
  if (others.length === 1) return option(others[0]);
  // Menú: todos los idiomas; el actual aparece marcado y no es un enlace.
  const item = (target: Locale) => {
    const current = target === locale;
    const body = (
      <>
        <LocaleFlag locale={target} />
        <span className="language-option-name">{locales[target].name}</span>
        {current && <Check className="language-option-check" size={16} aria-hidden="true" />}
      </>
    );
    if (current)
      return (
        <span key={target} className="language-option is-current" lang={target} aria-current="true">
          {body}
        </span>
      );
    return sites ? (
      <a
        key={target}
        className="language-option"
        href={otherUrl(target, pathname, search, hash)}
        hrefLang={target}
        lang={target}
        onClick={choose(target)}
      >
        {body}
      </a>
    ) : (
      <button key={target} type="button" className="language-option" lang={target} onClick={choose(target)}>
        {body}
      </button>
    );
  };
  return (
    <details className="language-menu">
      {/* El nombre accesible empieza por el código visible (WCAG 2.5.3, «label in name») */}
      <summary
        className="language-switcher"
        title={tr("language.changeLanguage")}
        aria-label={`${locale.toUpperCase()} · ${label(locale)}`}
      >
        <LocaleFlag locale={locale} />
        <span className="language-code">{locale.toUpperCase()}</span>
        <ChevronDown className="language-chevron" size={14} aria-hidden="true" />
      </summary>
      <div className="language-menu-list">
        <p className="language-menu-title">{tr("language.viewThisSite")}</p>
        {reachableLocales().map(item)}
      </div>
    </details>
  );
}
/**
 * Primera visita en web: si el navegador prefiere otro idioma disponible, lo propone en
 * ese idioma, sin redirigir. Se recuerda la respuesta y cualquier cambio con el selector.
 */
export function LanguageSuggestion() {
  const { locale } = useLocale();
  const { pathname, search, hash } = useLocation();
  const [suggested, setSuggested] = useState<Locale | null>(null);
  useEffect(() => {
    if (!sites) return;
    try {
      if (localStorage.getItem(SUGGESTION_DISMISSED)) return;
      const preferred = navigator.languages
        ?.map((tag) => tag.toLowerCase().split("-")[0])
        .find(isLocale);
      if (preferred && preferred !== locale && reachableLocales().includes(preferred))
        setSuggested(preferred);
    } catch {}
  }, [locale]);
  if (!suggested || suggested === locale) return null;
  const t = i18n.getFixedT(suggested);
  const close = () => {
    rememberChoice();
    setSuggested(null);
  };
  return (
    <aside className="language-suggestion" lang={suggested} aria-live="polite">
      <p>{t("language.suggest")}</p>
      <div className="language-suggestion-actions">
        <Button asChild><a
          href={otherUrl(suggested, pathname, search, hash)}
          hrefLang={suggested}
          onClick={(event) => {
            close();
            if (inPlace(suggested)) {
              event.preventDefault();
              switchPageLocale(suggested);
            }
          }}
        >
          {t("language.suggestAccept")}
        </a></Button>
        <Button variant="outline" type="button" onClick={close}>
          {t("language.suggestDismiss")}
        </Button>
      </div>
    </aside>
  );
}
/**
 * Mantiene canonical y hreflang al navegar sin recargar, con las mismas reglas
 * que el gateway: la URL de cada idioma (dominio, prefijo y ruta traducida), sin query,
 * y x-default en el principal.
 */
export function SeoLinks() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  useEffect(() => {
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", tr("common.metaDescription"));
    if (!sites) return;
    const set = (selector: string, target: Locale) => {
      const href = localeUrl(target, pathname, sites);
      if (href) document.querySelector(selector)?.setAttribute("href", href);
    };
    set('link[rel="canonical"]', locale);
    for (const target of supportedLocales)
      set(`link[rel="alternate"][hreflang="${target}"]`, target);
    set('link[rel="alternate"][hreflang="x-default"]', defaultLocale);
  }, [pathname, locale]);
  return null;
}
