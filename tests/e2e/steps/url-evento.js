import { expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { Given, When, Then, nuevaCuenta, fechaFutura } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

/** Dirección única por ejecución: la base de datos conserva los datos entre ejecuciones. */
const direccionUnica = () => `evento-${Date.now()}-${randomBytes(3).toString("hex")}`;

Given("que otra cuenta ya usa una dirección pública", async ({ page, ctx }) => {
  // Se crea antes de la cuenta del escenario: la sesión del navegador queda con la última.
  ctx.ocupada = direccionUnica();
  const cuenta = nuevaCuenta();
  const registro = await page.request.post("/api/auth/register", { headers: cabecera, data: cuenta });
  expect(registro.status()).toBe(201);
  const evento = await page.request.post("/api/events", {
    headers: cabecera,
    data: {
      title: "Evento de otra cuenta",
      description: "",
      date: fechaFutura,
      timeZone: "America/Mexico_City",
      location: "Jardín de pruebas",
      theme: "floral",
      slug: ctx.ocupada,
    },
  });
  expect(evento.status()).toBe(201);
});

Given("que otro de mis eventos ya usa una dirección", async ({ page, ctx }) => {
  ctx.ocupada = direccionUnica();
  const evento = await page.request.post("/api/events", {
    headers: cabecera,
    data: {
      title: "Otro evento mío",
      description: "",
      date: fechaFutura,
      timeZone: "America/Mexico_City",
      location: "Jardín de pruebas",
      theme: "floral",
      slug: ctx.ocupada,
    },
  });
  expect(evento.status()).toBe(201);
});

When("abro la edición del evento", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}/editar`);
});

When("escribo una dirección pública única en el campo {string}", async ({ page, ctx }, campo) => {
  ctx.direccion = direccionUnica();
  await page.getByLabel(campo, { exact: true }).fill(ctx.direccion);
});

When("escribo la dirección pública ocupada en el campo {string}", async ({ page, ctx }, campo) => {
  await page.getByLabel(campo, { exact: true }).fill(ctx.ocupada);
});

When("guardo los cambios del evento", async ({ page }) => {
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
});

When("abro la dirección pública de mi evento", async ({ page, ctx }) => {
  await page.goto(`/e/${ctx.direccion}`);
});

When("abro la dirección pública {string}", async ({ page }, direccion) => {
  await page.goto(`/e/${direccion}`);
});

Then("veo el encabezado {string}", async ({ page }, texto) => {
  await expect(page.getByRole("heading", { name: texto })).toBeVisible();
});

Then("no veo a los invitados {string}", async ({ page }, nombre) => {
  await expect(page.getByText(nombre)).toHaveCount(0);
});
