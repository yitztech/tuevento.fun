import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures.js";

// Solo el selector visible (en el menú cerrado, los enlaces de cada idioma están ocultos).
const selector = (page) => page.locator(".language-switcher:visible").first();

Given("que abro la página de inicio", async ({ ui }) => {
  await ui.abrir("/");
});

When("abro el selector de idioma", async ({ page }) => {
  await selector(page).click();
});

Then("el selector de idioma muestra la bandera y el código del idioma", async ({ page }) => {
  await expect(selector(page).locator(".locale-flag")).toBeVisible();
  await expect(selector(page).locator(".language-code")).toHaveText(/^[A-Z]{2}$/);
});

Then("el menú muestra todos los idiomas y marca el actual", async ({ page }) => {
  await expect(page.locator(".language-menu-list .language-option")).toHaveCount(5);
  await expect(page.locator(".language-menu-list .language-option.is-current .language-option-check")).toBeVisible();
});
