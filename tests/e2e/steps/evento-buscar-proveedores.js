import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, fechaFutura } from "./fixtures.js";
import { alNorte, codigoUnico, publicarNegocio, puntoUnico } from "./busqueda-proveedores.js";

const cabecera = { "x-tuevento-client": "1" };
const panel = (page) => page.getByRole("dialog", { name: "Proveedores cerca de tu evento" });

/** Organizador con la sesión abierta en el navegador (`page.request` comparte sus cookies) y un evento. */
async function eventoDeOrganizador(page, ctx, datos) {
  expect((await page.request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() })).status()).toBe(201);
  ctx.titulo = `Fiesta con proveedores ${codigoUnico()}`;
  const evento = await page.request.post("/api/events", {
    headers: cabecera,
    data: { title: ctx.titulo, description: "", date: fechaFutura, timeZone: "America/Mexico_City", theme: "floral", ...datos },
  });
  expect(evento.status()).toBe(201);
  ctx.evento = await evento.json();
}

Given("que tengo un evento en el mapa y un negocio publicado a {int} km del lugar", async ({ page, playwright, ctx }, km) => {
  const punto = puntoUnico();
  ctx.lugar = `Quinta Las Rosas ${codigoUnico()}`;
  ctx.negocio = await publicarNegocio(playwright, {
    businessName: `Mariachi Sol ${codigoUnico()}`,
    geo: alNorte(punto, km),
    addressVisibility: "exact",
  });
  await eventoDeOrganizador(page, ctx, { location: ctx.lugar, geo: punto });
});

Given("que tengo un evento en {string} sin punto en el mapa", async ({ page, ctx }, lugar) => {
  ctx.lugar = lugar;
  await eventoDeOrganizador(page, ctx, { location: lugar });
});

When("abro el detalle del evento", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}`);
});

Then("el panel busca cerca de la dirección del evento", async ({ page, ctx }) => {
  await expect(panel(page).getByRole("status").filter({ hasText: `Cerca de ${ctx.lugar}` })).toBeVisible();
});

Then("el panel busca cerca de {string}", async ({ page }, lugar) => {
  await expect(panel(page).getByRole("status").filter({ hasText: `Cerca de ${lugar}` })).toBeVisible();
});

Then("veo la tarjeta del negocio en el panel", async ({ page, ctx }) => {
  await expect(panel(page).getByRole("button", { name: new RegExp(ctx.negocio.businessName) })).toBeVisible();
});

When("abro la tarjeta del negocio en el panel", async ({ page, ctx }) => {
  await panel(page).getByRole("button", { name: new RegExp(ctx.negocio.businessName) }).click();
});

Then("veo la página del negocio dentro del panel", async ({ page, ctx }) => {
  await expect(panel(page).getByRole("heading", { level: 3, name: ctx.negocio.businessName })).toBeVisible();
  await expect(panel(page).getByRole("link", { name: "Escribir por WhatsApp" })).toBeVisible();
});

Then("el panel está cerrado y el foco vuelve al botón {string}", async ({ page }, boton) => {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: boton, exact: true })).toBeFocused();
});

Then("veo el título del evento", async ({ page, ctx }) => {
  await expect(page.getByRole("heading", { level: 1, name: ctx.titulo })).toBeVisible();
});
