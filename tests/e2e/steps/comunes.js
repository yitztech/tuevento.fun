import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
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
  const input = page.getByLabel(campo, { exact: true });
  await input.fill("");
  await input.pressSequentially(texto);
});

When("pego un texto de {int} letras en el campo {string}", async ({ page }, n, campo) => {
  await page.getByLabel(campo, { exact: true }).fill("a".repeat(n));
});

When("relleno el registro con datos válidos", async ({ page, ctx }) => {
  ctx.cuenta = nuevaCuenta();
  const c = ctx.cuenta;
  await page.getByLabel("Nombre(s)", { exact: true }).fill(c.firstName);
  await page.getByLabel("Apellido(s)", { exact: true }).fill(c.lastName);
  await page.getByLabel("Teléfono", { exact: true }).fill(c.phone);
  await page.getByLabel("Correo electrónico", { exact: true }).fill(c.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(c.password);
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
