import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures.js";

const cabecera = { "X-TuEvento-Client": "1" };

When("abro el panel de mi evento", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}`);
});

When("abro la página de pago de mi evento", async ({ page, ctx }) => {
  await page.goto(`/pago?evento=${ctx.evento.id}`);
});

Then("estoy en la página de pago de prueba", async ({ page }) => {
  await expect(page).toHaveURL(/\/pay\/cs_test_[0-9a-f]+$/);
  await expect(page.getByRole("heading", { name: "Pago de prueba" })).toBeVisible();
});

When("pago en la página de pago de prueba", async ({ page }) => {
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
});

When("cancelo en la página de pago de prueba", async ({ page }) => {
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
});

Then("veo el botón {string}", async ({ page }, texto) => {
  await expect(page.getByRole("button", { name: texto, exact: true })).toBeVisible();
});

Given("que ya pagué el tramo de hasta {int} invitados", async ({ page, ctx }, invitados) => {
  const tramo = [50, 100, 150].indexOf(invitados);
  const pago = await page.request.post(`/api/events/${ctx.evento.id}/checkout`, { headers: cabecera, data: { tier: tramo } });
  expect(pago.status()).toBe(200);
  const { url } = await pago.json();
  // Como el botón «Pagar» del doble: manda el webhook firmado y responde con la vuelta
  const pagado = await page.request.post(url, { form: { action: "pay" }, maxRedirects: 0 });
  expect(pagado.status()).toBe(303);
});
