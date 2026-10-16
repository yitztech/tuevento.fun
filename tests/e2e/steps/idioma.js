import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures.js";

// Solo el selector visible (en el menú cerrado, los enlaces de cada idioma están ocultos).
const selector = (page) => page.locator(".language-switcher:visible").first();
const codigo = (page) => selector(page).locator(".language-switcher-label");

Given("que abro la página de inicio", async ({ ui }) => {
  await ui.abrir("/");
});

Given("que el sistema pide contraste alto", async ({ page }) => {
  await page.emulateMedia({ contrast: "more", forcedColors: "active" });
});

When("paso el ratón por el selector de idioma", async ({ page }) => {
  await selector(page).hover();
});

Then("el selector de idioma muestra la bandera y oculta el código", async ({ page }) => {
  await expect(selector(page).locator(".locale-flag")).toBeVisible();
  await expect(codigo(page)).toBeHidden();
});

Then("el selector de idioma muestra el código {string}", async ({ page }, code) => {
  await expect(codigo(page)).toBeVisible();
  await expect(codigo(page)).toHaveText(code);
});
