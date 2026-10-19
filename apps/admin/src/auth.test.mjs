import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuth } from "./auth.mjs";
import { hashPassword } from "./password.mjs";

const USER = "yunerkis";
const PASSWORD = "clave-de-prueba-larga-1";

async function setup(clock = { t: 1_000_000 }) {
  const passwordHash = await hashPassword(PASSWORD);
  return { auth: createAuth({ username: USER, passwordHash, now: () => clock.t }), clock };
}

test("entra con usuario y contraseña correctos y recibe un token", async () => {
  const { auth } = await setup();
  const result = await auth.login("1.2.3.4", USER, PASSWORD);
  assert.ok(result.token);
  assert.equal(auth.valid(result.token), true);
});

test("rechaza usuario o contraseña incorrectos, sin revelar cuál falló", async () => {
  const { auth } = await setup();
  assert.deepEqual(await auth.login("1.2.3.4", "otro", PASSWORD), { error: "invalid" });
  assert.deepEqual(await auth.login("1.2.3.4", USER, "mala"), { error: "invalid" });
  assert.deepEqual(await auth.login("1.2.3.4", undefined, undefined), { error: "invalid" });
});

test("tras 10 fallos desde una IP se bloquea y solo esa IP", async () => {
  const { auth } = await setup();
  for (let i = 0; i < 10; i += 1) await auth.login("9.9.9.9", USER, "mala");
  assert.deepEqual(await auth.login("9.9.9.9", USER, PASSWORD), { error: "blocked" });
  assert.ok((await auth.login("8.8.8.8", USER, PASSWORD)).token);
});

test("el bloqueo caduca a los 15 minutos", async () => {
  const clock = { t: 1_000_000 };
  const { auth } = await setup(clock);
  for (let i = 0; i < 10; i += 1) await auth.login("9.9.9.9", USER, "mala");
  clock.t += 15 * 60 * 1000 + 1;
  assert.ok((await auth.login("9.9.9.9", USER, PASSWORD)).token);
});

test("la sesión caduca a las 12 horas y el cierre la invalida", async () => {
  const clock = { t: 1_000_000 };
  const { auth } = await setup(clock);
  const { token } = await auth.login("1.1.1.1", USER, PASSWORD);
  clock.t += 12 * 60 * 60 * 1000 - 1;
  assert.equal(auth.valid(token), true);
  clock.t += 2;
  assert.equal(auth.valid(token), false);

  const second = await auth.login("1.1.1.1", USER, PASSWORD);
  auth.logout(second.token);
  assert.equal(auth.valid(second.token), false);
  assert.equal(auth.valid(""), false);
  assert.equal(auth.valid("token-inventado"), false);
});
