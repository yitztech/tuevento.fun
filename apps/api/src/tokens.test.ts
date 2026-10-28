import assert from "node:assert/strict";
import test from "node:test";
import { newInvitationToken, openToken, sealToken, signLink, tokenLookup } from "./tokens";

// Las claves se derivan en el primer uso
process.env.APP_SECRET = "secreto-de-pruebas-con-mas-de-32-caracteres";

test("El token se guarda cifrado y se recupera; el hash de búsqueda es estable", () => {
  const { token, hash, sealed } = newInvitationToken();
  assert.match(token, /^[\w-]{32}$/);
  assert.ok(!sealed.includes(token) && hash !== token);
  assert.equal(openToken(sealed), token);
  assert.equal(tokenLookup(token), hash);
  assert.notEqual(sealToken(token), sealed, "cada cifrado lleva su propio nonce");
});

test("Una copia cifrada alterada no se abre", () => {
  const sealed = Buffer.from(sealToken("abc"), "base64url");
  sealed[14] ^= 1;
  assert.throws(() => openToken(sealed.toString("base64url")));
});

test("Las firmas de enlaces dependen del propósito", () => {
  assert.notEqual(signLink("baja", "x"), signLink("otro", "x"));
  assert.equal(signLink("baja", "x"), signLink("baja", "x"));
});
