import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.mjs";

test("el hash verifica la contraseña original y rechaza cualquier otra", async () => {
  const hash = await hashPassword("una-clave-larga-1!");
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword("una-clave-larga-1!", hash), true);
  assert.equal(await verifyPassword("una-clave-larga-2!", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("cada hash lleva su propia sal: la misma contraseña nunca produce el mismo valor", async () => {
  assert.notEqual(await hashPassword("misma-clave-larga"), await hashPassword("misma-clave-larga"));
});

test("un valor almacenado mal formado o de otro algoritmo nunca verifica", async () => {
  assert.equal(await verifyPassword("x", undefined), false);
  assert.equal(await verifyPassword("x", "md5$abc$def"), false);
  assert.equal(await verifyPassword("x", "scrypt$16384$8$1$$"), false);
});
