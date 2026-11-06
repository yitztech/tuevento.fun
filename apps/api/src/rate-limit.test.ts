import assert from "node:assert/strict";
import test from "node:test";
import { backoffDelayMs } from "./rate-limit";

test("El freno de la cuenta no bloquea: hace esperar cada vez más tras los fallos libres", () => {
  assert.equal(backoffDelayMs(4, 5, 60_000), 0, "los primeros fallos no esperan");
  assert.equal(backoffDelayMs(5, 5, 60_000), 1000);
  assert.equal(backoffDelayMs(6, 5, 60_000), 2000);
  assert.equal(backoffDelayMs(7, 5, 60_000), 4000);
  assert.equal(backoffDelayMs(30, 5, 60_000), 60_000, "la espera tiene tope");
});
