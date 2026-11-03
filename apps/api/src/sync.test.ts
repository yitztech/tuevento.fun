// Caducidad del cursor de GET /api/sync/changes (migraciones 028 y 029).
import test from "node:test";
import assert from "node:assert/strict";
import { cursorExpired, decodeCursor, encodeCursor } from "./sync-cursor";

const day = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-11-03T12:00:00Z");

test("El cursor es opaco y se lee igual que se escribió (segundos)", () => {
  const cursor = decodeCursor(encodeCursor(42, now));
  assert.deepEqual(cursor, { seq: 42, issuedAt: now });
});

test("Más de 90 días: caducado; sin purgas, nunca por número", () => {
  assert.equal(cursorExpired({ seq: 5, issuedAt: now - 91 * day }, undefined, now), true);
  assert.equal(cursorExpired({ seq: 5, issuedAt: now - 89 * day }, undefined, now), false);
  assert.equal(cursorExpired({ seq: -1, issuedAt: now }, { purgedSeq: 0, purgedAt: null }, now), false);
});

test("Anterior a la purga en número y en fecha: caducado (pudo perder tombstones)", () => {
  const clock = { purgedSeq: 100, purgedAt: new Date(now - day) };
  assert.equal(cursorExpired({ seq: 50, issuedAt: now - 2 * day }, clock, now), true);
  assert.equal(cursorExpired({ seq: 100, issuedAt: now - 2 * day }, clock, now), false, "ya tenía todo hasta lo purgado");
});

test("Emitido después de la purga (descarga completa a medias): vale aunque su número sea menor", () => {
  const clock = { purgedSeq: 100, purgedAt: new Date(now - day) };
  assert.equal(cursorExpired({ seq: 5, issuedAt: now - 60_000 }, clock, now), false);
});
