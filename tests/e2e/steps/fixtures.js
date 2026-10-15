import { test as base, createBdd } from "playwright-bdd";
import { randomBytes } from "node:crypto";
import { teclado, pausa } from "../support/entorno.js";

/** Escribe como una persona: vacía el campo y teclea con pausa entre teclas (E2E_TECLADO). */
export async function escribir(locator, texto) {
  await locator.fill("");
  await locator.pressSequentially(texto, { delay: teclado });
}

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
  /** Con E2E_PAUSA, deja el resultado a la vista unos segundos antes de cerrar el escenario. */
  verResultado: [
    async ({ page }, use) => {
      await use();
      if (pausa) await page.waitForTimeout(pausa).catch(() => {});
    },
    { auto: true },
  ],
});

export const { Given, When, Then } = createBdd(test);
