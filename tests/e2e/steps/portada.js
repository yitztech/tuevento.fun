import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures.js";
import { englishURL } from "../support/entorno.js";

Given("que abro la portada en inglés", async ({ page }) => {
  await page.goto(`${englishURL}/`);
});

When("en el ejemplo de asistencia respondo {string} por {string}", async ({ page }, respuesta, nombre) => {
  await page
    .getByRole("group", { name: `Respuesta de ${nombre}` })
    .getByRole("button", { name: respuesta, exact: true })
    .click();
});

When("pulso {string} en la navegación del sitio", async ({ page }, nombre) => {
  await page
    .getByRole("navigation", { name: "Navegación del sitio" })
    .getByRole("link", { name: nombre, exact: true })
    .click();
});

When("pulso la pregunta {string}", async ({ page }, pregunta) => {
  await page.getByRole("button", { name: pregunta, exact: true }).click();
});

Then("estoy en la página de registro para crear un evento", async ({ page }) => {
  await expect(page).toHaveURL(/\/registro\?empezar=evento$/);
});

Then("estoy en la página de acceso para crear un evento", async ({ page }) => {
  await expect(page).toHaveURL(/\/acceso\?empezar=evento$/);
});
