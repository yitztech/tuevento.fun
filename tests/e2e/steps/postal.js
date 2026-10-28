import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, fechaFutura } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

async function sinDesbordamiento(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

Given("que tengo un evento con una invitación", async ({ page, ctx }) => {
  ctx.cuenta = nuevaCuenta();
  const registro = await page.request.post("/api/auth/register", { headers: cabecera, data: ctx.cuenta });
  expect(registro.status()).toBe(201);
  const evento = await page.request.post("/api/events", {
    headers: cabecera,
    data: {
      title: "Fiesta de la postal",
      description: "",
      date: fechaFutura,
      timeZone: "America/Mexico_City",
      location: "Jardín de pruebas",
      theme: "floral",
    },
  });
  expect(evento.status()).toBe(201);
  ctx.evento = await evento.json();
  const unico = `${Date.now()}`;
  const invitacion = await page.request.post(`/api/events/${ctx.evento.id}/invitations`, {
    headers: cabecera,
    data: {
      name: "Familia de la postal",
      kind: "family",
      email: `postal-${unico}@example.invalid`,
      phone: "",
      notes: "",
      members: [{ name: "Ana García", kind: "adult", notes: "" }],
    },
  });
  expect(invitacion.status()).toBe(201);
  ctx.token = (await invitacion.json()).token;
});

Given("abro el editor de la postal del evento", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}/postal`);
  await expect(page.getByRole("heading", { name: "Diseña la postal" })).toBeVisible();
});

When("abro el editor de la postal a {int} por {int}", async ({ page, ctx }, ancho, alto) => {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(`/eventos/${ctx.evento.id}/postal`);
  await expect(page.locator(".postcard-canvas")).toBeVisible();
});

When("elijo el fondo de color {string}", async ({ page }, color) => {
  await page.getByRole("button", { name: `Color ${color}`, exact: true }).first().click();
});

When("añado el texto {string}", async ({ page }, texto) => {
  await page.getByRole("button", { name: "Añadir texto", exact: true }).click();
  await page.getByLabel("Texto", { exact: true }).fill(texto);
});

When("guardo la postal", async ({ page }) => {
  // Se espera la respuesta del guardado: el paso siguiente sale de la página y, en WebKit,
  // a veces lo hacía antes de que el PUT llegase a la API
  const guardado = page.waitForResponse(
    (r) => r.request().method() === "PUT" && /\/api\/events\/[^/]+\/postcard$/.test(new URL(r.url()).pathname),
  );
  await page.getByRole("button", { name: "Guardar postal", exact: true }).click();
  expect((await guardado).ok()).toBe(true);
});

When("abro la invitación del evento", async ({ page, ctx }) => {
  await page.goto(`/i/${ctx.token}`);
});

Then("la invitación muestra la postal con el texto {string}", async ({ page }, texto) => {
  await expect(page.locator(".postcard-canvas .postcard-text", { hasText: texto })).toBeVisible();
});

Then("la postal cabe sin desbordamiento horizontal", async ({ page }) => {
  await expect(page.locator(".postcard-canvas")).toBeVisible();
  await sinDesbordamiento(page);
});
