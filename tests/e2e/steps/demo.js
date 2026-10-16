import { Given, When, Then } from "./fixtures.js";

Given("que abro la aplicación sin sesión", async ({ ui }) => {
  await ui.abrir("/app");
});

When("pulso el enlace {string} de la portada", async ({ page }, nombre) => {
  await page.getByRole("link", { name: nombre, exact: true }).first().click();
});

Then("estoy en la página de acceso", async ({ ui }) => {
  await ui.esperarUrl(/\/acceso$/);
});

Then("estoy en la página de registro", async ({ ui }) => {
  await ui.esperarUrl(/\/registro/);
});
