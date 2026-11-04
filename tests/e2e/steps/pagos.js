import { expect } from "@playwright/test";
import { adminURL, baseURL, englishURL } from "../support/entorno.js";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
import { eventoNuevo } from "./landing.js";

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

// Los cupones los crea el administrador en su panel: aquí se usa la misma API
Given("que existe un cupón del {int} %", async ({ page, ctx }, porcentaje) => {
  const entrada = await page.request.post(`${adminURL}/api/login`, { data: { username: "admin-dev", password: "admin-dev-password" } });
  expect(entrada.status()).toBe(200);
  ctx.cupon = `QA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const creado = await page.request.post(`${adminURL}/api/coupons`, { data: { code: ctx.cupon, percentOff: porcentaje } });
  expect(creado.status()).toBe(201);
});

const campoCupon = (page) => page.getByRole("textbox", { name: /cup|coupon|gutschein|promo/i });

When("escribo el cupón {string}", async ({ page }, codigo) => {
  await campoCupon(page).pressSequentially(codigo);
});

When("aplico el cupón", async ({ page, ctx }) => {
  await campoCupon(page).fill(ctx.cupon);
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
});

Then("veo que el cupón está aplicado", async ({ page, ctx }) => {
  await expect(page.getByRole("status")).toContainText(`Cupón ${ctx.cupon} aplicado.`);
});

Then("el cupón escrito es {string}", async ({ page }, valor) => {
  await expect(campoCupon(page)).toHaveValue(valor);
});

When("pulso el primer botón {string}", async ({ page }, texto) => {
  await page.getByRole("button", { name: texto, exact: true }).first().click();
});

// La sesión es de cada dominio: la cuenta se abre en el dominio del idioma
When("abro la página de pago de un evento mío en {string}", async ({ page }, idioma) => {
  const dominio = idioma === "es" ? baseURL : englishURL;
  const raiz = ["pt", "de", "fr"].includes(idioma) ? `${dominio}/${idioma}` : dominio;
  const registro = await page.request.post(`${dominio}/api/auth/register`, { headers: cabecera, data: nuevaCuenta() });
  expect(registro.status()).toBe(201);
  const evento = await page.request.post(`${dominio}/api/events`, { headers: cabecera, data: eventoNuevo(`Cena ${Date.now()}`) });
  expect(evento.status()).toBe(201);
  await page.goto(`${raiz}/pago?evento=${(await evento.json()).id}`);
});

Then("veo el campo de cupón {string}", async ({ page }, etiqueta) => {
  // El francés lleva un espacio fino antes del signo de interrogación
  await expect(page.getByLabel(etiqueta.replace(" ?", "\u202f?"), { exact: true })).toBeVisible();
});
