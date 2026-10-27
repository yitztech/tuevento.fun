import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };
const menu = (page) => page.getByRole("navigation", { name: "Navegación principal" });

Given("que abro la portada", async ({ page }) => {
  await page.goto("/");
});

Given("que tengo una cuenta de proveedor con la sesión abierta", async ({ page }) => {
  // `page.request` comparte las cookies del navegador: la sesión queda abierta
  const registro = await page.request.post("/api/auth/register", { headers: cabecera, data: { ...nuevaCuenta(), accountType: "provider" } });
  expect(registro.status()).toBe(201);
});

When("elijo la opción {string}", async ({ page }, opcion) => {
  await page.getByRole("radio", { name: new RegExp(opcion) }).check();
});

When("abro la página {string}", async ({ page }, ruta) => {
  await page.goto(ruta);
});

Then("la opción {string} está elegida", async ({ page }, opcion) => {
  await expect(page.getByRole("radio", { name: new RegExp(opcion) })).toBeChecked();
});

Then("estoy en {string}", async ({ page }, ruta) => {
  await expect(page).toHaveURL(new RegExp(`${ruta}$`));
});

Then("veo el enlace {string} en el menú", async ({ page }, texto) => {
  await expect(menu(page).getByRole("link", { name: new RegExp(`^${texto}`) })).toHaveCount(1);
});

Then("no veo el enlace {string} en el menú", async ({ page }, texto) => {
  await expect(menu(page).getByRole("link", { name: new RegExp(`^${texto}`) })).toHaveCount(0);
});
