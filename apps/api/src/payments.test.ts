import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import { validStripeSignature } from "./payments";

const secret = `whsec_${randomBytes(24).toString("hex")}`;
const body = JSON.stringify({ type: "checkout.session.completed" });
const now = 1_800_000_000_000;
const sign = (t: number, raw = body, key = secret) =>
  `t=${t},v1=${createHmac("sha256", key).update(`${t}.${raw}`).digest("hex")}`;

test("La firma de Stripe es válida con la clave del webhook y el cuerpo exacto", () => {
  assert.equal(validStripeSignature(body, sign(now / 1000), secret, now), true);
  // Stripe puede mandar varias firmas (rotación de la clave): basta una buena
  assert.equal(validStripeSignature(body, `${sign(now / 1000)},v1=${"0".repeat(64)}`, secret, now), true);
});

test("Una firma con otra clave, otro cuerpo o mal formada se rechaza", () => {
  assert.equal(validStripeSignature(body, sign(now / 1000, body, "otra"), secret, now), false);
  assert.equal(validStripeSignature(`${body} `, sign(now / 1000), secret, now), false);
  assert.equal(validStripeSignature(body, "t=abc,v1=xyz", secret, now), false);
  assert.equal(validStripeSignature(body, "", secret, now), false);
});

test("Un webhook de hace más de 5 minutos se rechaza: no se puede repetir uno capturado", () => {
  assert.equal(validStripeSignature(body, sign(now / 1000 - 301), secret, now), false);
  assert.equal(validStripeSignature(body, sign(now / 1000 - 299), secret, now), true);
});
