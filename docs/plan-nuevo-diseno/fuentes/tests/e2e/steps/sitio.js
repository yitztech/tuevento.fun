import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures.js";

const muestras = (page) => page.getByRole("group", { name: "Elige un diseño de ejemplo" });
const menu = (page) => page.getByRole("button", { name: /^(Abrir|Cerrar) menú$/ });

When("filtro los diseños por {string}", async ({ page }, estilo) => {
  await page.getByRole("group", { name: "Filtrar diseños por estilo" }).getByRole("button", { name: estilo, exact: true }).click();
});

Then("veo {int} diseños de muestra", async ({ page }, cantidad) => {
  await expect(muestras(page).getByRole("listitem")).toHaveCount(cantidad);
});

Then("la dirección termina en {string}", async ({ page }, final) => {
  await page.waitForURL((url) => `${url.pathname}${url.search}`.endsWith(final));
});

When("pulso {string} en el pie", async ({ page }, nombre) => {
  await page.getByRole("navigation", { name: "Enlaces del pie de página" }).getByRole("link", { name: nombre, exact: true }).click();
});

Given("que abro la portada en un teléfono", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
});

When("abro el menú del sitio", async ({ page }) => {
  await menu(page).click();
  await expect(menu(page)).toHaveAttribute("aria-expanded", "true");
});

When("pulso la tecla Escape", async ({ page }) => {
  await page.keyboard.press("Escape");
});

Then("el menú del sitio está cerrado", async ({ page }) => {
  await expect(menu(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: "Navegación del sitio" })).toBeHidden();
});

Given("que abro la página de acceso en un escritorio", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/acceso");
});
