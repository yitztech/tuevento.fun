import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, registrar } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

Given("que abro la página de precios", async ({ ui }) => {
  await ui.abrir("/planes");
});

Given("que tengo una cuenta creada y entro a mi espacio", async ({ page }) => {
  // `page.request` comparte las cookies del navegador: la sesión queda abierta.
  const r = await registrar(page.request, "/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
  expect(r.status()).toBe(201);
  await page.goto("/app");
});

When("exploro la demostración", async ({ page }) => {
  await page.getByRole("button", { name: "Explorar la demostración", exact: true }).click();
});

Then("veo el botón destacado {string}", async ({ page }, texto) => {
  const boton = page.getByRole("link", { name: texto, exact: true });
  await expect(boton).toBeVisible();
  await expect(boton).toHaveClass(/demo-pay/);
});

When("pulso el botón destacado {string}", async ({ page }, texto) => {
  await page.getByRole("link", { name: texto, exact: true }).click();
});

Then("estoy en la página de pago", async ({ ui }) => {
  await ui.esperarUrl(/\/pago$/);
});

When("abro la pestaña {string}", async ({ page }, nombre) => {
  await pestana(page, nombre).click();
});

Then("veo la pestaña {string} seleccionada", async ({ page }, nombre) => {
  await expect(pestana(page, nombre)).toHaveAttribute("aria-selected", "true");
});

Then("veo la pestaña {string}", async ({ page }, nombre) => {
  await expect(pestana(page, nombre)).toBeVisible();
});

Then("el plan {string} muestra {string}", async ({ page }, plan, texto) => {
  await expect(page.getByRole("article", { name: plan, exact: true })).toContainText(texto);
});

When("elijo el plan {string}", async ({ page }, plan) => {
  await page.getByRole("article", { name: plan, exact: true }).getByRole("link").click();
});

Then("estoy en la página de planes", async ({ ui }) => {
  await ui.esperarUrl(/\/planes$/);
});

Then("estoy en la página de pago del plan {string}", async ({ ui }, plan) => {
  await ui.esperarUrl(new RegExp(`/planes/pago\\?plan=${plan}$`));
});

Then("el resumen de la compra muestra {string}", async ({ page }, texto) => {
  await expect(page.getByRole("region", { name: "Resumen del plan" })).toContainText(texto);
});

Then("el total a pagar es {string}", async ({ page }, total) => {
  await expect(page.getByRole("definition").last()).toHaveText(total);
});

Then("los datos de la tarjeta no se pueden escribir", async ({ page }) => {
  for (const campo of ["Número de tarjeta", "Fecha de caducidad", "CVC", "Nombre en la tarjeta"])
    await expect(page.getByLabel(campo, { exact: true })).toBeDisabled();
});

Then("no veo los datos de la tarjeta", async ({ page }) => {
  await expect(page.getByLabel("Número de tarjeta", { exact: true })).toHaveCount(0);
});

When("elijo pagar con {string}", async ({ page }, metodo) => {
  await page.getByRole("radio", { name: metodo }).check();
});

// El nombre accesible de la pestaña incluye su subtítulo, que en el móvil no se ve
function pestana(page, nombre) {
  return page.getByRole("tab", { name: nombre });
}

// Stripe aún sin integrar: el escenario que lo usa lleva @pendiente
When("pago con una tarjeta de prueba", async ({ page }) => {
  await page.getByRole("button", { name: /^Pagar / }).click();
});
