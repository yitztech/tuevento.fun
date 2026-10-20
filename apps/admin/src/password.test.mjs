import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, isPasswordHash, verifyPassword } from "./password.mjs";

test("el hash verifica la contraseña original y rechaza cualquier otra", async () => {
  const hash = await hashPassword("una-clave-larga-1!");
  assert.match(hash, /^scrypt:16384:8:1:/);
  assert.equal(await verifyPassword("una-clave-larga-1!", hash), true);
  assert.equal(await verifyPassword("una-clave-larga-2!", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("el hash no lleva `$`, que Docker Compose y Coolify interpretarían como variable", async () => {
  assert.doesNotMatch(await hashPassword("una-clave-larga-1!"), /\$/);
});

test("el formato anterior, con `$`, sigue verificando", async () => {
  const hash = (await hashPassword("una-clave-larga-1!")).replaceAll(":", "$");
  assert.equal(isPasswordHash(hash), true);
  assert.equal(await verifyPassword("una-clave-larga-1!", hash), true);
});

test("cada hash lleva su propia sal: la misma contraseña nunca produce el mismo valor", async () => {
  assert.notEqual(await hashPassword("misma-clave-larga"), await hashPassword("misma-clave-larga"));
});

test("un valor almacenado mal formado o de otro algoritmo nunca verifica", async () => {
  assert.equal(await verifyPassword("x", undefined), false);
  assert.equal(await verifyPassword("x", "md5$abc$def"), false);
  assert.equal(await verifyPassword("x", "scrypt$16384$8$1$$"), false);
});

test("un hash recortado (como el que deja `$` sin escapar) no se acepta al arrancar", async () => {
  const hash = await hashPassword("una-clave-larga-1!");
  assert.equal(isPasswordHash(hash), true);
  assert.equal(isPasswordHash("scrypt"), false);
  assert.equal(isPasswordHash(hash.slice(0, -10)), false);
  assert.equal(isPasswordHash(hash.split(":").slice(0, 5).join(":")), false);
  assert.equal(isPasswordHash(`${hash}:extra`), false);
});
