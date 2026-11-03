import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

// Solo web: la portada no existe dentro de las apps (arrancan en el acceso)
Given("que abro la portada", async ({ page }) => {
  await page.goto("/");
});

Given("que tengo una cuenta de proveedor con la sesión abierta", async ({ request, ui }) => {
  // `request` no comparte la sesión con la app (web ni móvil): se entra con el formulario
  const cuenta = nuevaCuenta();
  const registro = await request.post("/api/auth/register", { headers: cabecera, data: { ...cuenta, accountType: "provider" } });
  expect(registro.status()).toBe(201);
  await ui.abrir("/acceso");
  await ui.escribir("Correo electrónico", cuenta.email);
  await ui.escribir("Contraseña", cuenta.password);
  await ui.pulsar("Entrar a mi espacio");
  await ui.esperarUrl(/\/negocio$/);
});

When("elijo la opción {string}", async ({ ui }, opcion) => {
  await ui.elegirOpcion(opcion);
});

When("abro la página {string}", async ({ ui }, ruta) => {
  await ui.abrir(ruta);
});

Then("la opción {string} está elegida", async ({ ui }, opcion) => {
  await ui.esperarOpcionElegida(opcion);
});

Then("estoy en {string}", async ({ ui }, ruta) => {
  await ui.esperarUrl(new RegExp(`${ruta}$`));
});

Then("veo el enlace {string} en el menú", async ({ ui }, texto) => {
  await ui.esperarEnlaceMenu(texto, true);
});

Then("no veo el enlace {string} en el menú", async ({ ui }, texto) => {
  await ui.esperarEnlaceMenu(texto, false);
});
