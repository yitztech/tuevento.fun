import { expect } from "@playwright/test";
import { adminURL } from "../support/entorno.js";
import { Given, When, Then } from "./fixtures.js";

// Panel de administración (servicio admin): solo en web, en su propio origen.
// Estas funciones usan `page`, que existe en la web (en móvil no se prueba este panel).

Given("que el panel se abre en un móvil de {int} por {int}", async ({ page }, ancho, alto) => {
  await page.setViewportSize({ width: ancho, height: alto });
});

When("abro el panel de administración", async ({ page }) => {
  await page.goto(adminURL);
});

When("entro al panel con el usuario {string} y la contraseña {string}", async ({ page }, usuario, clave) => {
  await page.getByLabel("Usuario", { exact: true }).fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
});

const clave = (page) => page.getByLabel("Contraseña", { exact: true });

When("escribo la contraseña {string} en el panel", async ({ page }, texto) => {
  await clave(page).fill(texto);
});

When("pulso {string} en el panel", async ({ page }, nombre) => {
  await page.getByRole("button", { name: nombre, exact: true }).click();
});

Then("la contraseña del panel está oculta", async ({ page }) => {
  await expect(clave(page)).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Mostrar contraseña", exact: true })).toHaveAttribute("aria-pressed", "false");
});

Then("la contraseña del panel se ve como {string}", async ({ page }, texto) => {
  await expect(clave(page)).toHaveAttribute("type", "text");
  await expect(clave(page)).toHaveValue(texto);
  await expect(page.getByRole("button", { name: "Ocultar contraseña", exact: true })).toHaveAttribute("aria-pressed", "true");
});

When("salgo del panel", async ({ page }) => {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
});

When("pido las estadísticas del panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.get(`${adminURL}/api/stats`)).status();
});

When("pido la salud del panel", async ({ page, ctx }) => {
  const respuesta = await page.request.get(`${adminURL}/api/health`);
  ctx.estado = respuesta.status();
  ctx.cuerpo = await respuesta.json();
});

Then("el panel responde {int} con el estado {string}", async ({ ctx }, estado, valor) => {
  expect(ctx.estado).toBe(estado);
  expect(ctx.cuerpo).toEqual({ status: valor });
});

When("pido los países del panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.get(`${adminURL}/api/countries`)).status();
});

// La API de Umami solo responde a producción: aquí se simula la respuesta del panel a /api/countries
Given("que Umami responde con {int} visitantes de {string} y {int} de {string}", async ({ page }, n1, p1, n2, p2) => {
  await page.route("**/api/countries*", (route) =>
    route.fulfill({ json: { available: true, days: 30, rows: [{ country: p1, visitors: n1 }, { country: p2, visitors: n2 }] } }),
  );
});

Given("que Umami no responde", async ({ page }) => {
  await page.route("**/api/countries*", (route) => route.fulfill({ status: 502, json: { error: "umami" } }));
});

const paises = (page) => page.getByRole("article", { name: "Visitantes por país" });

Then("veo {string} en los visitantes por país", async ({ page }, texto) => {
  await expect(paises(page).getByText(texto, { exact: true })).toBeVisible();
});

Then("los visitantes por país muestran {string} con {int} y {string} con {int}", async ({ page }, pais1, n1, pais2, n2) => {
  const filas = paises(page).getByRole("row");
  await expect(filas).toHaveCount(2);
  for (const [fila, pais, n] of [[0, pais1, n1], [1, pais2, n2]]) {
    await expect(filas.nth(fila).getByRole("rowheader")).toHaveText(pais);
    await expect(filas.nth(fila).getByRole("cell")).toHaveText(String(n));
  }
});

Then("veo el error {string} del panel", async ({ page }, texto) => {
  await expect(page.getByRole("alert").filter({ hasText: texto })).toBeVisible();
});

Then("veo el resumen del panel con {string} y {string}", async ({ page }, primero, segundo) => {
  await expect(page.getByText(primero, { exact: true })).toBeVisible();
  await expect(page.getByText(segundo, { exact: true })).toBeVisible();
});

Then("el panel responde {int}", async ({ ctx }, estado) => {
  expect(ctx.estado).toBe(estado);
});

Then("el panel cabe en pantalla sin desbordamiento horizontal", async ({ page }) => {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(ancho).toBeLessThanOrEqual(visible);
});

Then("veo el formulario de entrada del panel", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Entrar al panel", exact: true })).toBeVisible();
});
