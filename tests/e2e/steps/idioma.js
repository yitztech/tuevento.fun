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

Then("el selector de idioma muestra el código del idioma sin bandera", async ({ page }) => {
  await expect(selector(page).locator(".language-code")).toHaveText(/^[A-Z]{2}$/);
  await expect(selector(page).locator(".locale-flag")).toHaveCount(0);
});

Then("cada idioma del menú lleva su bandera", async ({ page }) => {
  await expect(page.locator(".language-menu-list .language-option .locale-flag")).toHaveCount(5);
});

Then("el selector de idioma no tiene borde ni fondo", async ({ page }) => {
  const boton = page.locator(".language-menu > summary:visible").first();
  await expect(boton).toHaveCSS("border-top-width", "0px");
  await expect(boton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

Then("el check queda pegado al nombre del idioma actual y al borde del menú", async ({ page }) => {
  const { alNombre, alBorde } = await page.locator(".language-option.is-current").evaluate((opcion) => {
    const texto = document.createRange();
    texto.selectNodeContents(opcion.querySelector(".language-option-name"));
    const check = opcion.querySelector(".language-option-check").getBoundingClientRect();
    return {
      alNombre: check.left - texto.getBoundingClientRect().right,
      alBorde: opcion.getBoundingClientRect().right - check.right,
    };
  });
  expect(Math.abs(alNombre - 17)).toBeLessThanOrEqual(2);
  expect(Math.abs(alBorde - 11)).toBeLessThanOrEqual(1);
});

When("hago clic fuera del menú de idiomas", async ({ page }) => {
  await page.locator("body").click({ position: { x: 4, y: 300 } });
});

When("pulso Escape", async ({ page }) => {
  await page.keyboard.press("Escape");
});

Then("el menú de idiomas está cerrado", async ({ page }) => {
  await expect(page.locator(".language-menu-list")).toBeHidden();
});

Then("el foco está en el botón del selector de idioma", async ({ page }) => {
  await expect(page.locator(".language-menu > summary:visible").first()).toBeFocused();
});

Then("el menú solo contiene los idiomas", async ({ page }) => {
  const lista = page.locator(".language-menu-list");
  await expect(lista).toBeVisible();
  await expect(lista.locator("> *")).toHaveCount(5);
  await expect(lista.locator("> .language-option")).toHaveCount(5);
});

Then("el menú muestra todos los idiomas y marca el actual", async ({ page }) => {
  await expect(page.locator(".language-menu-list .language-option")).toHaveCount(5);
  await expect(page.locator(".language-menu-list .language-option.is-current .language-option-check")).toBeVisible();
});
