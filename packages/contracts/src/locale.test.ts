import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localeForHost,
  localizedPage,
  translatePath,
  parseSiteOrigins,
} from "./index";
const EN = "https://yourevent.fun";
test("El idioma lo decide el Host: el dominio inglés y su www son en", () => {
  assert.equal(localeForHost("yourevent.fun", EN), "en");
  assert.equal(localeForHost("www.yourevent.fun", EN), "en");
  assert.equal(localeForHost("YourEvent.FUN:443", EN), "en");
  assert.equal(localeForHost("yourevent.fun.", EN), "en");
  assert.equal(localeForHost("tuevento.fun", EN), "es");
  assert.equal(localeForHost("www.tuevento.fun", EN), "es");
});
test("Un Host desconocido, vacío o sin SITE_URL_EN usa es", () => {
  assert.equal(localeForHost("evil.example", EN), "es");
  assert.equal(localeForHost("sub.yourevent.fun", EN), "es");
  assert.equal(localeForHost("yourevent.fun.evil.example", EN), "es");
  assert.equal(localeForHost("127.0.0.1:3087", EN), "es");
  assert.equal(localeForHost("[::1]:3087", EN), "es");
  assert.equal(localeForHost(undefined, EN), "es");
  assert.equal(localeForHost("", EN), "es");
  assert.equal(localeForHost("yourevent.fun", undefined), "es");
  assert.equal(localeForHost("yourevent.fun", "no es una url"), "es");
});
test("En desarrollo el dominio en de OrbStack es inglés", () => {
  const dev = "https://en.tueventofun.orb.local";
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
  assert.equal(parseSiteOrigins("es=javascript:alert(1) en=https://yourevent.fun"), null);
  assert.equal(parseSiteOrigins(""), null);
  assert.equal(parseSiteOrigins(null), null);
});
