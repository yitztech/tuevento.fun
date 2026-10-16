import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

Given("que abro la página de precios", async ({ ui }) => {
  await ui.abrir("/precios");
});

Given("que tengo una cuenta creada y entro a mi espacio", async ({ page }) => {
  // `page.request` comparte las cookies del navegador: la sesión queda abierta.
  const r = await page.request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
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
