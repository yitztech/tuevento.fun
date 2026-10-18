import test from "node:test";
import assert from "node:assert/strict";
import { calendarFile, googleCalendarUrl, icsText, mapsSearchUrl, slugify } from "./calendar";

const start = new Date("2027-06-12T18:00:00Z");

test("El .ics tiene fecha UTC, fin a 2 h y estado confirmado", () => {
  const ics = calendarFile({ uid: "abc", title: "Boda", description: "", start, location: "", cancelled: false, now: start });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.ok(ics.includes("DTSTART:20270612T180000Z\r\n"));
  assert.ok(ics.includes("DTEND:20270612T200000Z\r\n"));
  assert.ok(ics.includes("UID:abc@tuevento.fun\r\n"));
  assert.ok(ics.includes("STATUS:CONFIRMED\r\n"));
  assert.ok(!ics.includes("LOCATION:"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("Un evento cancelado se marca como CANCELLED y lleva ubicación y enlace", () => {
  const ics = calendarFile({ uid: "abc", title: "Boda", description: "", start, location: "Jardín, Norte", url: "https://tuevento.fun/e/boda", cancelled: true, now: start });
  assert.ok(ics.includes("STATUS:CANCELLED\r\n"));
  assert.ok(ics.includes("LOCATION:Jardín\\, Norte\r\n"));
  assert.ok(ics.includes("URL:https://tuevento.fun/e/boda\r\n"));
});

test("El texto se escapa y las líneas largas se pliegan a 75 octetos", () => {
  assert.equal(icsText("a;b,c\\d\ne"), "a\;b\\,c\\\\d\\ne");
  const ics = calendarFile({ uid: "x", title: "T", description: "á".repeat(200), start, location: "", cancelled: false, now: start });
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("Google Calendar recibe fechas UTC y el texto codificado", () => {
  const url = googleCalendarUrl({ title: "Fiesta & baile", description: "", start, location: "Calle 1" });
  const params = new URL(url).searchParams;
  assert.equal(params.get("text"), "Fiesta & baile");
  assert.equal(params.get("dates"), "20270612T180000Z/20270612T200000Z");
  assert.equal(params.get("location"), "Calle 1");
});

test("El enlace de mapa codifica la ubicación", () => {
  assert.equal(mapsSearchUrl("Casa del Sol, Cuernavaca"), "https://www.google.com/maps/search/?api=1&query=Casa%20del%20Sol%2C%20Cuernavaca");
});

test("slugify quita acentos, pone guiones y respeta el máximo", () => {
  assert.equal(slugify("  Boda de Ana & Luis 2027!  "), "boda-de-ana-luis-2027");
  assert.equal(slugify("Cumpleaños de José"), "cumpleanos-de-jose");
  assert.equal(slugify("¡¡¡"), "");
  assert.ok(slugify("a".repeat(100)).length <= 60);
  assert.ok(!slugify("x ".repeat(40)).endsWith("-"));
});
