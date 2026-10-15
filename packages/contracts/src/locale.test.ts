import { test } from "node:test";
import assert from "node:assert/strict";
import {
  domainLocales,
  localeForHost,
  localeForRequest,
  localePrefix,
  localeUrl,
  locales,
  prefixedLocale,
  siteLocale,
  supportedLocales,
  localizedPage,
  translatePath,
  parseSiteOrigins,
  siteOriginsFromEnv,
} from "./index";
const EN = { es: "https://tuevento.fun", en: "https://yourevent.fun" };
test("El idioma lo decide el Host: el dominio inglés y su www son en", () => {
  assert.equal(localeForHost("yourevent.fun", EN), "en");
  assert.equal(localeForHost("www.yourevent.fun", EN), "en");
  assert.equal(localeForHost("YourEvent.FUN:443", EN), "en");
  assert.equal(localeForHost("yourevent.fun.", EN), "en");
  assert.equal(localeForHost("tuevento.fun", EN), "es");
  assert.equal(localeForHost("www.tuevento.fun", EN), "es");
});
test("Un Host desconocido, vacío o sin dominio del idioma usa el principal", () => {
  assert.equal(localeForHost("evil.example", EN), "es");
  assert.equal(localeForHost("sub.yourevent.fun", EN), "es");
  assert.equal(localeForHost("yourevent.fun.evil.example", EN), "es");
  assert.equal(localeForHost("127.0.0.1:3087", EN), "es");
  assert.equal(localeForHost("[::1]:3087", EN), "es");
  assert.equal(localeForHost(undefined, EN), "es");
  assert.equal(localeForHost("", EN), "es");
  assert.equal(localeForHost("yourevent.fun", {}), "es");
  assert.equal(
    localeForHost("yourevent.fun", siteOriginsFromEnv({ SITE_URL_EN: "no es una url" })),
    "es",
  );
});
test("En desarrollo el dominio en de OrbStack es inglés", () => {
  const dev = { en: "https://en.tueventofun.orb.local" };
  assert.equal(localeForHost("en.tueventofun.orb.local", dev), "en");
  assert.equal(localeForHost("tueventofun.orb.local", dev), "es");
  assert.equal(localeForHost("localhost:5187", dev), "es");
});
test("Mapa común de rutas traducidas", () => {
  assert.equal(translatePath("/privacidad", "en"), "/privacy");
  assert.equal(translatePath("/privacy", "es"), "/privacidad");
  assert.equal(translatePath("/privacy", "en"), "/privacy");
  assert.equal(translatePath("/condiciones", "en"), "/terms");
  assert.equal(translatePath("/terms", "es"), "/condiciones");
  assert.equal(translatePath("/terms/", "es"), "/condiciones");
  // Las demás rutas son iguales en ambos idiomas
  assert.equal(translatePath("/registro", "en"), "/registro");
  assert.equal(translatePath("/", "en"), "/");
  assert.equal(translatePath("", "es"), "/");
  assert.equal(localizedPage("/descargas"), null);
  assert.equal(localizedPage("/privacy"), "privacy");
});
test("Orígenes publicados por el gateway", () => {
  assert.deepEqual(
    parseSiteOrigins("es=https://tuevento.fun en=https://yourevent.fun"),
    { es: "https://tuevento.fun", en: "https://yourevent.fun" },
  );
  assert.deepEqual(
    parseSiteOrigins(" es=https://tuevento.fun/  en=https://yourevent.fun/x "),
    { es: "https://tuevento.fun", en: "https://yourevent.fun" },
  );
  assert.equal(parseSiteOrigins("es=https://tuevento.fun"), null);
  assert.equal(parseSiteOrigins("en=https://yourevent.fun fr=https://tonevent.fun"), null);
  // Idiomas que la app no conoce se ignoran
  assert.deepEqual(
    parseSiteOrigins("es=https://tuevento.fun en=https://yourevent.fun xx=https://x.fun"),
    { es: "https://tuevento.fun", en: "https://yourevent.fun" },
  );
  assert.equal(parseSiteOrigins("es=javascript:alert(1) en=https://yourevent.fun"), null);
  assert.equal(parseSiteOrigins(""), null);
  assert.equal(parseSiteOrigins(null), null);
});
test("Dominios por idioma desde el entorno: SITE_URL_<IDIOMA> y SITE_URL para el principal", () => {
  assert.deepEqual(
    siteOriginsFromEnv({ SITE_URL: "https://tuevento.fun/", SITE_URL_EN: "https://yourevent.fun" }),
    { es: "https://tuevento.fun", en: "https://yourevent.fun" },
  );
  assert.deepEqual(
    siteOriginsFromEnv({ SITE_URL: "https://a.fun", SITE_URL_ES: "https://tuevento.fun" }),
    { es: "https://tuevento.fun" },
  );
  assert.deepEqual(siteOriginsFromEnv({ SITE_URL_EN: "ftp://yourevent.fun" }), {});
});

test("Portugués y alemán viven en el dominio inglés bajo /pt y /de", () => {
  assert.deepEqual(domainLocales, ["es", "en"]);
  assert.equal(siteLocale("pt"), "en");
  assert.equal(siteLocale("de"), "en");
  assert.equal(siteLocale("es"), "es");
  assert.equal(localePrefix("pt"), "/pt");
  assert.equal(localePrefix("en"), "");
  // Un idioma alojado lo está en un idioma con dominio propio (sin cadenas)
  for (const locale of supportedLocales) {
    const host = (locales[locale] as { hostedBy?: string }).hostedBy;
    if (host) assert.ok(domainLocales.includes(siteLocale(locale)), `${locale}: hostedBy ${host}`);
  }
});
test("Prefijo de idioma en la ruta", () => {
  assert.deepEqual(prefixedLocale("/pt"), { locale: "pt", path: "/" });
  assert.deepEqual(prefixedLocale("/pt/"), { locale: "pt", path: "/" });
  assert.deepEqual(prefixedLocale("/de/registro"), { locale: "de", path: "/registro" });
  assert.equal(prefixedLocale("/ptx"), null);
  assert.equal(prefixedLocale("/privacy"), null);
  assert.equal(prefixedLocale("/en/registro"), null);
});
test("URL de una página en cada idioma: dominio, prefijo y ruta traducida", () => {
  assert.equal(localeUrl("pt", "/privacy", EN), "https://yourevent.fun/pt/privacidade");
  assert.equal(localeUrl("de", "/condiciones", EN), "https://yourevent.fun/de/nutzungsbedingungen");
  assert.equal(localeUrl("pt", "/", EN), "https://yourevent.fun/pt/");
  assert.equal(localeUrl("en", "/registro", EN), "https://yourevent.fun/registro");
  assert.equal(localeUrl("es", "/privacy", EN), "https://tuevento.fun/privacidad");
  assert.equal(localeUrl("pt", "/", { es: "https://tuevento.fun" }), null);
});
test("La API acepta el idioma de la página solo si el dominio lo aloja", () => {
  assert.equal(localeForRequest("yourevent.fun", "pt", false, EN), "pt");
  assert.equal(localeForRequest("yourevent.fun", "de", false, EN), "de");
  assert.equal(localeForRequest("yourevent.fun", "es", false, EN), "en");
  assert.equal(localeForRequest("yourevent.fun", "xx", false, EN), "en");
  assert.equal(localeForRequest("yourevent.fun", undefined, false, EN), "en");
  assert.equal(localeForRequest("tuevento.fun", "pt", false, EN), "es");
  assert.equal(localeForRequest("tuevento.fun", "en", false, EN), "es");
  // Apps móviles: dominio principal y el idioma elegido en la app
  assert.equal(localeForRequest("tuevento.fun", "pt", true, EN), "pt");
  assert.equal(localeForRequest("tuevento.fun", "en", true, EN), "en");
  assert.equal(localeForRequest("yourevent.fun", "es", true, EN), "en");
});
test("Los idiomas alojados no tienen dominio propio ni en el entorno ni en tuevento:sites", () => {
  assert.deepEqual(
    siteOriginsFromEnv({ SITE_URL_ES: "https://tuevento.fun", SITE_URL_PT: "https://pt.fun" }),
    { es: "https://tuevento.fun" },
  );
  assert.deepEqual(
    parseSiteOrigins("es=https://tuevento.fun en=https://yourevent.fun pt=https://pt.fun"),
    { es: "https://tuevento.fun", en: "https://yourevent.fun" },
  );
  assert.equal(localeForHost("pt.fun", { ...EN, pt: "https://pt.fun" }), "es");
});
