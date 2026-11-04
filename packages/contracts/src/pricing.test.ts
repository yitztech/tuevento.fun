import test from "node:test";
import assert from "node:assert/strict";
import { canAddGuests, discountedCents, guestTiers, MIN_CHARGE_CENTS, tierForGuests, upgradeCents } from "./pricing";

const usd = (guests: number) => tierForGuests(guests).usd;

test("Precio por evento: 5 USD hasta 50 invitados, 10 hasta 100, 20 hasta 150 y 30 para más", () => {
  assert.equal(usd(1), 5);
  assert.equal(usd(50), 5);
  assert.equal(usd(51), 10);
  assert.equal(usd(100), 10);
  assert.equal(usd(101), 20);
  assert.equal(usd(150), 20);
  assert.equal(usd(151), 30);
  assert.equal(usd(5000), 30);
});

test("Un evento sin invitados cuenta en el tramo más bajo", () => {
  assert.equal(usd(0), 5);
});

test("Número de invitados inválido: se rechaza", () => {
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => tierForGuests(value), RangeError, String(value));
});

test("Los tramos están ordenados y el último no tiene límite", () => {
  const limits = guestTiers.map((t) => t.maxGuests);
  assert.deepEqual(limits, [50, 100, 150, null]);
  assert.deepEqual(
    guestTiers.map((t) => t.usd),
    [5, 10, 20, 30],
  );
});

test("Al añadir invitados se respeta el máximo del tramo pagado", () => {
  const cincuenta = tierForGuests(10); // 5 USD: hasta 50
  assert.equal(canAddGuests(40, 10, cincuenta), true);
  assert.equal(canAddGuests(40, 11, cincuenta), false);
  const cien = tierForGuests(60); // 10 USD: hasta 100
  assert.equal(canAddGuests(90, 10, cien), true);
  assert.equal(canAddGuests(90, 11, cien), false);
  const mas = tierForGuests(200); // 30 USD: sin límite
  assert.equal(canAddGuests(10000, 1000, mas), true);
});

test("Añadir cero invitados nunca supera el límite", () => {
  assert.equal(canAddGuests(50, 0, tierForGuests(10)), true);
});

test("Invitados a añadir inválidos: se rechazan", () => {
  for (const value of [-1, 0.5])
    assert.throws(() => canAddGuests(1, value, tierForGuests(1)), RangeError, String(value));
});

test("Pasar a un tramo mayor cobra solo la diferencia, en centavos", () => {
  assert.equal(upgradeCents(null, 0), 500);
  assert.equal(upgradeCents(null, 3), 3000);
  assert.equal(upgradeCents(0, 2), 1500);
  assert.equal(upgradeCents(2, 3), 1000);
  assert.equal(upgradeCents(2, 1), 0, "un tramo menor que el pagado no cuesta nada");
});

test("Un cupón descuenta un porcentaje o una cantidad", () => {
  assert.equal(discountedCents(1000, { percentOff: 25, amountOffCents: null }), 750);
  assert.equal(discountedCents(1000, { percentOff: null, amountOffCents: 300 }), 700);
  // Redondea al centavo más cercano
  assert.equal(discountedCents(500, { percentOff: 33, amountOffCents: null }), 335);
});

test("Un cupón que cubre todo deja el pago en 0", () => {
  assert.equal(discountedCents(500, { percentOff: 100, amountOffCents: null }), 0);
  assert.equal(discountedCents(500, { percentOff: null, amountOffCents: 500 }), 0);
  assert.equal(discountedCents(500, { percentOff: null, amountOffCents: 9000 }), 0);
});

test("Un cupón no deja un cobro por debajo del mínimo de la tarjeta", () => {
  assert.equal(discountedCents(500, { percentOff: 99, amountOffCents: null }), MIN_CHARGE_CENTS);
  assert.equal(discountedCents(500, { percentOff: null, amountOffCents: 499 }), MIN_CHARGE_CENTS);
  assert.equal(discountedCents(500, { percentOff: null, amountOffCents: 400 }), MIN_CHARGE_CENTS);
  // Nunca cobra más que sin cupón
  assert.equal(discountedCents(50, { percentOff: 10, amountOffCents: null }), 50);
});
