import { expect } from "@playwright/test";
import { adminURL } from "../support/entorno.js";
import { Given, When, Then } from "./fixtures.js";

// Panel de administración (servicio admin): solo en web, en su propio origen.
// Estas funciones usan `page`, que existe en la web (en móvil no se prueba este panel).

Given("que el panel se abre en un móvil de {int} por {int}", async ({ page }, ancho, alto) => {
  await page.setViewportSize({ width: ancho, height: alto });
});

When("abro el panel de administración", async ({ page }) => {
  await page.goto(adminURL);
});

When("entro al panel con el usuario {string} y la contraseña {string}", async ({ page }, usuario, clave) => {
  await page.getByLabel("Usuario", { exact: true }).fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
});

When("salgo del panel", async ({ page }) => {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
});

When("pido las estadísticas del panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.get(`${adminURL}/api/stats`)).status();
});

Then("veo el error {string} del panel", async ({ page }, texto) => {
  await expect(page.getByRole("alert").filter({ hasText: texto })).toBeVisible();
});

Then("veo el resumen del panel con {string} y {string}", async ({ page }, primero, segundo) => {
  await expect(page.getByText(primero, { exact: true })).toBeVisible();
  await expect(page.getByText(segundo, { exact: true })).toBeVisible();
});

Then("el panel responde {int}", async ({ ctx }, estado) => {
  expect(ctx.estado).toBe(estado);
});

Then("el panel cabe en pantalla sin desbordamiento horizontal", async ({ page }) => {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(ancho).toBeLessThanOrEqual(visible);
});

Then("veo el formulario de entrada del panel", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Entrar al panel", exact: true })).toBeVisible();
});
