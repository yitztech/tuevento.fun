import assert from "node:assert/strict";
import test from "node:test";
import { parseCoupon, parseCouponState } from "./coupons.mjs";

const rejected = (fn) => assert.throws(fn, (error) => error.status === 422);

test("Un cupón válido se normaliza en mayúsculas", () => {
  assert.deepEqual(parseCoupon({ code: " verano-26 ", percentOff: 20 }), {
    code: "VERANO-26", percentOff: 20, amountOffCents: null, expiresAt: null, maxRedemptions: null,
  });
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  assert.deepEqual(parseCoupon({ code: "DOS", amountOffCents: 500, expiresAt, maxRedemptions: 10 }), {
    code: "DOS", percentOff: null, amountOffCents: 500, expiresAt, maxRedemptions: 10,
  });
});

test("Un cupón con datos no válidos se rechaza", () => {
  for (const code of ["", "ab", "con espacio", "ñandú", "A".repeat(33)]) rejected(() => parseCoupon({ code, percentOff: 10 }));
  rejected(() => parseCoupon({ code: "SIN" }));
  rejected(() => parseCoupon({ code: "LOS-DOS", percentOff: 10, amountOffCents: 100 }));
  for (const percentOff of [0, 101, 1.5, "10"]) rejected(() => parseCoupon({ code: "PCT", percentOff }));
  for (const amountOffCents of [0, 100_001, 1.5]) rejected(() => parseCoupon({ code: "CANT", amountOffCents }));
  rejected(() => parseCoupon({ code: "USOS", percentOff: 10, maxRedemptions: 0 }));
  rejected(() => parseCoupon({ code: "PASADO", percentOff: 10, expiresAt: "2020-01-01T00:00:00Z" }));
  rejected(() => parseCoupon({ code: "FECHA", percentOff: 10, expiresAt: "mañana" }));
});

test("Activar o desactivar exige un id y un valor booleano", () => {
  const id = "0195f0a0-1234-7abc-8def-0123456789ab";
  assert.deepEqual(parseCouponState({ id, active: false }), { id, active: false });
  rejected(() => parseCouponState({ id: "1", active: false }));
  rejected(() => parseCouponState({ id, active: "no" }));
});
