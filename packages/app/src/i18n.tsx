import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  englishMessages,
  normalizeLocale,
  type Locale,
} from "@tuevento/contracts";
const storageKey = "tueventofun:locale";
function initialLocale(): Locale {
  try {
    const query = new URLSearchParams(window.location.search).get("lang");
    if (query === "es" || query === "en") return query;
    return normalizeLocale(localStorage.getItem(storageKey));
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
    lng: initialLocale(),
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
  normalizeLocale(i18n.resolvedLanguage || i18n.language);
export const formatLocale = () => (getLocale() === "en" ? "en-US" : "es-MX");
export const tr = (key: string, values?: Record<string, unknown>): string =>
  String(i18n.t(key, { defaultValue: key, ...values }));
export function useLocale() {
  const { i18n: active } = useTranslation(undefined, { i18n });
  return {
    locale: normalizeLocale(active.resolvedLanguage || active.language),
    setLocale: (locale: Locale) => {
      void active.changeLanguage(locale);
      try {
        localStorage.setItem(storageKey, locale);
      } catch {}
      document.documentElement.lang = locale;
      document.title =
        locale === "en"
          ? "TuEventoFun · A good reason to celebrate"
          : "TuEventoFun · Un buen motivo para celebrar";
      const url = new URL(window.location.href);
      if (url.searchParams.has("lang")) {
        url.searchParams.set("lang", locale);
        window.history.replaceState(null, "", url);
      }
    },
  };
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switcher">
      <Languages size={16} />
      <span className="sr-only">{tr("Cambiar idioma")}</span>
      <select
        aria-label={tr("Cambiar idioma")}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
