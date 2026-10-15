import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, escribir } from "./fixtures.js";
import { englishURL } from "../support/entorno.js";

const cabecera = { "x-tuevento-client": "1" };

Given("que abro la página de registro", async ({ page }) => {
  await page.goto("/registro");
});

Given("que abro la página de registro en inglés", async ({ page }) => {
  await page.goto(`${englishURL}/registro`);
});

Given("que tengo una cuenta creada y abro mi perfil", async ({ page, ctx }) => {
  ctx.cuenta = nuevaCuenta();
  // `page.request` comparte las cookies del navegador: la sesión queda abierta.
  const r = await page.request.post("/api/auth/register", { headers: cabecera, data: ctx.cuenta });
  expect(r.status()).toBe(201);
  await page.goto("/perfil");
});

When("escribo {string} en el campo {string}", async ({ page }, texto, campo) => {
  await escribir(page.getByLabel(campo, { exact: true }), texto);
});

When("pego un texto de {int} letras en el campo {string}", async ({ page }, n, campo) => {
  await page.getByLabel(campo, { exact: true }).fill("a".repeat(n));
});

When("relleno el registro con datos válidos", async ({ page, ctx }) => {
  ctx.cuenta = nuevaCuenta();
  const c = ctx.cuenta;
  await escribir(page.getByLabel("Nombre(s)", { exact: true }), c.firstName);
  await escribir(page.getByLabel("Apellido(s)", { exact: true }), c.lastName);
  await escribir(page.getByLabel("Teléfono", { exact: true }), c.phone);
  await escribir(page.getByLabel("Correo electrónico", { exact: true }), c.email);
  await escribir(page.getByLabel("Contraseña", { exact: true }), c.password);
});

When("envío el formulario de registro", async ({ page }) => {
  await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
});

When("guardo los cambios del perfil", async ({ page }) => {
  await page.getByRole("button", { name: "Guardar cambios" }).click();
});

Then("entro a mi espacio", async ({ page }) => {
  await expect(page).toHaveURL(/\/app$/);
});

Then("el campo {string} contiene {string}", async ({ page }, campo, valor) => {
  await expect(page.getByLabel(campo, { exact: true })).toHaveValue(valor);
});

Then("el campo {string} admite como máximo {int} caracteres", async ({ page }, campo, n) => {
  await expect(page.getByLabel(campo, { exact: true })).toHaveAttribute("maxlength", String(n));
});

Then("veo el campo {string}", async ({ page }, campo) => {
  await expect(page.getByLabel(campo, { exact: true })).toBeVisible();
});

Then("no existe el campo {string}", async ({ page }, campo) => {
  await expect(page.getByLabel(campo, { exact: true })).toHaveCount(0);
});

Then("veo el aviso {string}", async ({ page }, texto) => {
  await expect(page.getByText(texto).first()).toBeVisible();
});
