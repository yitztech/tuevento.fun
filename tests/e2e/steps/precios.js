import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, registrar } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

Given("que abro la página de precios", async ({ ui }) => {
  await ui.abrir("/precios");
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

Then("la tabla {string} tiene la fila {string}", async ({ page }, tabla, fila) => {
  // Las celdas de la fila se escriben separadas por « | », como se leen en la tabla
  const esperada = fila.split(" | ");
  const filas = page.getByRole("tabpanel", { name: tabla }).getByRole("row");
  await expect
    .poll(async () => (await filas.evaluateAll((rows) => rows.map((row) => [...row.children].map((c) => c.textContent?.trim() ?? "")))).some((celdas) => celdas.join("|") === esperada.join("|")))
    .toBe(true);
});

When("abro la pestaña {string}", async ({ page }, nombre) => {
  await page.getByRole("tab", { name: nombre, exact: true }).click();
});

Then("veo la pestaña {string} seleccionada", async ({ page }, nombre) => {
  await expect(page.getByRole("tab", { name: nombre, exact: true })).toHaveAttribute("aria-selected", "true");
});

Then("veo la pestaña {string}", async ({ page }, nombre) => {
  await expect(page.getByRole("tab", { name: nombre, exact: true })).toBeVisible();
});
