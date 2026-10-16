import { expect } from "@playwright/test";
import { Given, Then } from "./fixtures.js";

// Solo el selector visible (en el menú cerrado, los enlaces de cada idioma están ocultos).
const selector = (page) => page.locator(".language-switcher:visible").first();

Given("que abro la página de inicio", async ({ ui }) => {
  await ui.abrir("/");
});

Then("el selector de idioma muestra la bandera sin texto", async ({ page }) => {
  await expect(selector(page).locator(".locale-flag")).toBeVisible();
  await expect(selector(page)).toHaveText("");
});
