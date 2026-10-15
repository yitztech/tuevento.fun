import { test as base, createBdd } from "playwright-bdd";
import { randomBytes } from "node:crypto";

/** Datos de una cuenta válida y única, para no depender del estado de la base de datos. */
export function nuevaCuenta(extra = {}) {
  const unico = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  return {
    firstName: "Paula",
    lastName: "Prueba",
    email: `e2e-${unico}@example.invalid`,
    phone: "+527771234567",
    password: randomBytes(12).toString("hex"),
    ...extra,
  };
}

export const test = base.extend({
  /** Estado compartido entre los pasos de un mismo escenario. */
  ctx: async ({}, use) => use({}),
});

export const { Given, When, Then } = createBdd(test);
