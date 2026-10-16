import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
import { englishURL } from "../support/entorno.js";

const cabecera = { "x-tuevento-client": "1" };

Given("que abro la página de registro", async ({ ui }) => {
  await ui.abrir("/registro");
});

Given("que abro la página de acceso", async ({ ui }) => {
  await ui.abrir("/acceso");
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

When("escribo {string} en el campo {string}", async ({ ui }, texto, campo) => {
  await ui.escribir(campo, texto);
});

When("pego un texto de {int} letras en el campo {string}", async ({ ui }, n, campo) => {
  await ui.pegar(campo, "a".repeat(n));
});

When("relleno el registro con datos válidos", async ({ ui, ctx }) => {
  ctx.cuenta = nuevaCuenta();
  const c = ctx.cuenta;
  await ui.escribir("Nombre(s)", c.firstName);
  await ui.escribir("Apellido(s)", c.lastName);
  await ui.escribir("Teléfono", c.phone);
  await ui.escribir("Correo electrónico", c.email);
  await ui.escribir("Contraseña", c.password);
});

When("envío el formulario de registro", async ({ ui }) => {
  await ui.pulsar("Crear mi cuenta");
});

When("envío el formulario de acceso", async ({ ui }) => {
  await ui.pulsar("Entrar a mi espacio");
});

When("guardo los cambios del perfil", async ({ ui }) => {
  await ui.pulsar("Guardar cambios");
});

Then("entro a mi espacio", async ({ ui }) => {
  await ui.esperarUrl(/\/app$/);
});

Then("el campo {string} contiene {string}", async ({ ui }, campo, valor) => {
  await ui.esperarValor(campo, valor);
});

Then("el campo {string} admite como máximo {int} caracteres", async ({ ui }, campo, n) => {
  await ui.esperarAtributo(campo, "maxlength", String(n));
});

Then("veo el campo {string}", async ({ ui }, campo) => {
  await ui.esperarVisible(campo);
});

Then("no existe el campo {string}", async ({ ui }, campo) => {
  await ui.esperarAusente(campo);
});

Then("veo el aviso {string}", async ({ ui }, texto) => {
  await ui.esperarTexto(texto);
});
