import test from "node:test";
import assert from "node:assert/strict";
import { calendarFile, mapLinks } from "./calendar";
import { coordinatesFromMapLink } from "./geo";
import { geoLinkSchema, geoSearchSchema } from "./index";

const plaza = { lat: 18.921831, lng: -99.234567 };

test("Con punto exacto, los enlaces de mapas van a las coordenadas", () => {
  const links = mapLinks({ label: "Jardín Borda", geo: plaza });
  assert.equal(links.google, "https://www.google.com/maps/search/?api=1&query=18.921831,-99.234567");
  assert.equal(links.directions, "https://www.google.com/maps/dir/?api=1&destination=18.921831,-99.234567");
  assert.equal(links.apple, "https://maps.apple.com/?q=Jard%C3%ADn%20Borda&ll=18.921831,-99.234567");
  assert.equal(links.waze, "https://waze.com/ul?ll=18.921831,-99.234567&navigate=yes");
});

test("Sin punto, los enlaces de mapas buscan el texto del lugar", () => {
  const links = mapLinks({ label: "Casa del Sol, Cuernavaca", geo: null });
  assert.equal(links.waze, "https://waze.com/ul?q=Casa%20del%20Sol%2C%20Cuernavaca&navigate=yes");
  assert.equal(links.apple, "https://maps.apple.com/?q=Casa%20del%20Sol%2C%20Cuernavaca");
});

test("El .ics lleva GEO solo si hay punto, sin ceros de sobra", () => {
  const start = new Date("2027-06-12T18:00:00Z");
  const base = { uid: "x", title: "T", description: "", start, location: "Plaza", cancelled: false, now: start };
  assert.ok(calendarFile({ ...base, geo: { lat: 19.5, lng: -99 } }).includes("GEO:19.5;-99\r\n"));
  assert.ok(!calendarFile(base).includes("GEO:"));
});

test("Se leen las coordenadas de los enlaces de Google Maps, Apple Maps y Waze", () => {
  const cases: [string, { lat: number; lng: number }][] = [
    ["https://www.google.com/maps/place/Jard%C3%ADn/@18.9,-99.2,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d18.921831!4d-99.234567", plaza],
    ["https://www.google.com/maps/search/?api=1&query=18.921831,-99.234567", plaza],
    ["https://maps.google.com/?q=18.921831,-99.234567", plaza],
    ["https://www.google.com/maps/@18.921831,-99.234567,15z", plaza],
    ["https://maps.apple.com/?ll=18.921831,-99.234567&q=Jard%C3%ADn", plaza],
    ["https://maps.apple.com/place?address=x&coordinate=1&ll=18.921831,-99.234567", plaza],
    ["https://waze.com/ul?ll=18.921831,-99.234567&navigate=yes", plaza],
    ["https://www.google.com/maps/dir/?api=1&destination=18.921831,-99.234567", plaza],
  ];
  for (const [link, expected] of cases) assert.deepEqual(coordinatesFromMapLink(link), expected, link);
});

test("El punto marcado (!3d!4d) gana al centro de la vista (@)", () => {
  const link = "https://www.google.com/maps/place/X/@10,20,17z/data=!3d18.921831!4d-99.234567";
  assert.deepEqual(coordinatesFromMapLink(link), plaza);
});

test("Sin coordenadas, fuera de rango o de otro host, no hay punto", () => {
  for (const link of [
    "https://www.google.com/maps/place/Jard%C3%ADn+Borda",
    "https://maps.google.com/?q=95,10",
    "https://evil.example/maps/@18.9,-99.2,15z",
    "http://maps.google.com/?q=18.9,-99.2",
    "no es un enlace",
  ])
    assert.equal(coordinatesFromMapLink(link), null, link);
});

test("Solo se aceptan enlaces https de las apps de mapas", () => {
  assert.ok(geoLinkSchema.safeParse({ url: "https://maps.app.goo.gl/abc123" }).success);
  for (const url of ["http://maps.app.goo.gl/abc", "https://maps.app.goo.gl.evil.example/x", "https://example.com/?q=1,2", "javascript:alert(1)"]) {
    const parsed = geoLinkSchema.safeParse({ url });
    assert.equal(parsed.success, false, url);
    assert.equal(parsed.error?.issues[0].message, "validation.mapLinkNotSupported");
  }
  const long = geoLinkSchema.safeParse({ url: `https://maps.google.com/?q=${"a".repeat(2048)}` });
  assert.equal(long.error?.issues[0].message, "validation.maximum2048Characters");
});

test("La búsqueda en el mapa pide de 3 a 200 caracteres", () => {
  assert.equal(geoSearchSchema.safeParse({ q: " ab " }).error?.issues[0].message, "validation.useLeast3Characters");
  assert.equal(geoSearchSchema.safeParse({ q: "a".repeat(201) }).error?.issues[0].message, "validation.maximum200Characters");
  assert.deepEqual(geoSearchSchema.parse({ q: "  Cuernavaca " }), { q: "Cuernavaca" });
});
