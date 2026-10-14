import { useEffect } from "react";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Languages } from "lucide-react";
import {
  englishMessages,
  parseSiteOrigins,
  translatePath,
  type Locale,
  type SiteOrigins,
} from "@tuevento/contracts";
/**
 * Un idioma por dominio: el gateway decide el idioma por el Host y lo escribe en
 * <html lang>. La SPA solo lo lee; no usa ?lang=, localStorage ni el idioma del
 * navegador. Sin gateway (vite dev, app nativa) el HTML trae lang="es".
 */
function documentLocale(): Locale {
  try {
    const hasSites =
      typeof document !== "undefined" &&
      Boolean(document.querySelector('meta[name="tuevento:sites"]'));
    if (!hasSites && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("tueventofun:app_locale");
      if (stored === "en" || stored === "es") return stored;
      if (
        typeof navigator !== "undefined" &&
        navigator.language?.toLowerCase().startsWith("en")
      ) {
        return "en";
      }
    }
    return document.documentElement.lang === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}
const spanish = Object.fromEntries(
  Object.keys(englishMessages).map((key) => [key, key]),
);
export const i18n = i18next.createInstance();
void i18n
  .use(initReactI18next)
  .init({
    lng: documentLocale(),
    fallbackLng: "es",
    supportedLngs: ["es", "en"],
    resources: {
      es: { translation: spanish },
      en: { translation: englishMessages },
    },
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
export const getLocale = (): Locale =>
  i18n.resolvedLanguage === "en" || i18n.language === "en" ? "en" : "es";
export const formatLocale = () => (getLocale() === "en" ? "en-US" : "es-MX");
export const tr = (key: string, values?: Record<string, unknown>): string =>
  String(i18n.t(key, { defaultValue: key, ...values }));
export function useLocale() {
  const { i18n: active } = useTranslation(undefined, { i18n });
  return {
    locale: (active.resolvedLanguage === "en" ? "en" : "es") as Locale,
  };
}
/** Cambia el idioma en apps móviles o entornos sin gateway de dominios. */
export function switchAppLocale(target: Locale) {
  try {
    localStorage.setItem("tueventofun:app_locale", target);
    document.documentElement.lang = target;
  } catch {}
  void i18n.changeLanguage(target);
}
/** Orígenes de cada idioma que publica el gateway en <meta name="tuevento:sites">. */
export function siteOrigins(): SiteOrigins | null {
  try {
    return parseSiteOrigins(
      document
        .querySelector('meta[name="tuevento:sites"]')
        ?.getAttribute("content"),
    );
  } catch {
    return null;
  }
}
/**
 * Enlace al mismo contenido en el otro dominio (en web) o botón interactivo de cambio (en app móvil).
 */
export function LanguageSwitcher() {
  const { locale } = useLocale();
  const { pathname, search, hash } = useLocation();
  const sites = siteOrigins();
  const other: Locale = locale === "es" ? "en" : "es";
  if (!sites) {
    return (
      <button
        type="button"
        className="language-switcher"
        onClick={() => switchAppLocale(other)}
        title={tr("Cambiar idioma")}
        aria-label={tr("Cambiar idioma")}
      >
        <Languages size={16} aria-hidden="true" />
        <span className="language-switcher-label">
          {other === "en" ? "English" : "Español"}
        </span>
      </button>
    );
  }
  const href = `${sites[other]}${translatePath(pathname, other)}${search}${hash}`;
  return (
    <a
      className="language-switcher"
      href={href}
      hrefLang={other}
      lang={other}
      title={tr("Cambiar idioma")}
    >
      <Languages size={16} aria-hidden="true" />
      <span className="language-switcher-label">
        {other === "en" ? "English" : "Español"}
      </span>
    </a>
  );
}
/**
 * Mantiene canonical y hreflang al navegar sin recargar, con las mismas reglas
 * que el gateway: ruta del idioma del dominio, sin query, y x-default en español.
 */
export function SeoLinks() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  useEffect(() => {
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        locale === "en"
          ? "Create invitations in your style, share a private link and see who will attend your celebration, person by person."
          : "Crea invitaciones con tu estilo, comparte un enlace privado y conoce quién asistirá a tu celebración, persona por persona.",
      );
    const sites = siteOrigins();
    if (!sites) return;
    const url = (target: Locale) =>
      `${sites[target]}${translatePath(pathname, target)}`;
    const set = (selector: string, href: string) =>
      document.querySelector(selector)?.setAttribute("href", href);
    set('link[rel="canonical"]', url(locale));
    set('link[rel="alternate"][hreflang="es"]', url("es"));
    set('link[rel="alternate"][hreflang="en"]', url("en"));
    set('link[rel="alternate"][hreflang="x-default"]', url("es"));
  }, [pathname, locale]);
  return null;
}
