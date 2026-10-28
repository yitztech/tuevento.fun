import assert from "node:assert/strict";
import test from "node:test";
import { Backoff } from "./rate-limit";

const retryAfter = (fn: () => void) => {
  try {
    fn();
    return 0;
  } catch (e) {
    return (e as { problem: { status: number; retryAfter: number } }).problem.retryAfter;
  }
};

test("El freno de la cuenta no bloquea: hace esperar cada vez más tras los fallos libres", () => {
  const backoff = new Backoff(5, 60_000, 50, 3_600_000);
  const t = 1_000_000;
  for (let i = 0; i < 4; i++) backoff.fail("a", t);
  assert.equal(retryAfter(() => backoff.check("a", t)), 0, "los primeros fallos no esperan");
  backoff.fail("a", t);
  assert.equal(retryAfter(() => backoff.check("a", t)), 1);
  assert.equal(retryAfter(() => backoff.check("a", t + 1000)), 0, "pasada la espera se puede volver a intentar");
  backoff.fail("a", t + 1000);
  assert.equal(retryAfter(() => backoff.check("a", t + 1000)), 2);
  for (let i = 0; i < 20; i++) backoff.fail("a", t + 2000);
  assert.equal(retryAfter(() => backoff.check("a", t + 2000)), 60, "la espera tiene tope");
  assert.equal(retryAfter(() => backoff.check("b", t + 2000)), 0, "cada cuenta va aparte");
});

test("Solo cierra del todo con el freno de emergencia, y avisa una vez", () => {
  const backoff = new Backoff(5, 60_000, 50, 3_600_000);
  const t = 1_000_000;
  const closed = Array.from({ length: 51 }, () => backoff.fail("a", t)).filter(Boolean);
  assert.equal(closed.length, 1);
  assert.equal(retryAfter(() => backoff.check("a", t + 120_000)), 3480, "cerrada hasta el final de la ventana");
  assert.equal(retryAfter(() => backoff.check("a", t + 3_600_000)), 0, "al acabar la ventana se reabre");
});

test("Al entrar bien o recuperar la cuenta, el freno se borra", () => {
  const backoff = new Backoff(5, 60_000, 50, 3_600_000);
  for (let i = 0; i < 10; i++) backoff.fail("a", 0);
  backoff.reset("a");
  assert.equal(retryAfter(() => backoff.check("a", 0)), 0);
});
