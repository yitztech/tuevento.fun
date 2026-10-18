import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

async function registrarCuenta(page) {
  const cuenta = nuevaCuenta();
  const registro = await page.request.post("/api/auth/register", { headers: cabecera, data: cuenta });
  expect(registro.status()).toBe(201);
}

Given("que tengo un enlace genérico del evento", async ({ page, ctx }) => {
  const r = await page.request.post(`/api/events/${ctx.evento.id}/invitations`, {
    headers: cabecera,
    data: { name: "Enlace para todos", kind: "open", email: "", phone: "", notes: "", members: [] },
  });
  expect(r.status()).toBe(201);
  ctx.genericToken = (await r.json()).token;
});

Given("que cancelo el evento por la API", async ({ page, ctx }) => {
  const e = ctx.evento;
  const r = await page.request.patch(`/api/events/${e.id}`, {
    headers: cabecera,
    data: {
      title: e.title,
      description: e.description,
      date: e.date,
      timeZone: e.timeZone,
      location: e.location,
      theme: e.theme,
      archived: false,
      cancelled: true,
    },
  });
  expect(r.status()).toBe(200);
});

Given("que tengo un evento con dirección pública y contraseña {string}", async ({ page, ctx }, clave) => {
  await registrarCuenta(page);
  ctx.titulo = `Boda de prueba ${Date.now()}`;
  ctx.slug = `prueba-${Date.now()}`;
  const r = await page.request.post("/api/events", {
    headers: cabecera,
    data: {
      title: ctx.titulo,
      description: "",
      date: "2027-06-12T18:00:00Z",
      timeZone: "America/Mexico_City",
      location: "Jardín de pruebas",
      theme: "floral",
      slug: ctx.slug,
      publicPassword: clave,
    },
  });
  expect(r.status()).toBe(201);
});

Given("que tengo un evento con dirección pública", async ({ page, ctx }) => {
  await registrarCuenta(page);
  ctx.titulo = `Fiesta pública ${Date.now()}`;
  ctx.slug = `publica-${Date.now()}`;
  const r = await page.request.post("/api/events", {
    headers: cabecera,
    data: {
      title: ctx.titulo,
      description: "",
      date: "2027-06-12T18:00:00Z",
      timeZone: "America/Mexico_City",
      location: "Jardín de pruebas",
      theme: "floral",
      slug: ctx.slug,
    },
  });
  expect(r.status()).toBe(201);
});

Given("que tengo una cuenta creada y abro un evento nuevo", async ({ page }) => {
  await registrarCuenta(page);
  await page.goto("/eventos/nuevo");
});

When("cancelo el evento desde el editor", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}/editar`);
  await page.locator("label.check-row", { hasText: "Cancelar el evento" }).locator("input").check();
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("Cambios guardados.").first()).toBeVisible();
});

When("abro el enlace genérico", async ({ page, ctx }) => {
  await page.goto(`/i/${ctx.genericToken}`);
});

When("abro la página pública del evento", async ({ page, ctx }) => {
  await page.goto(`/e/${ctx.slug}`);
});

When("relleno el campo {string} con {string}", async ({ page }, campo, texto) => {
  await page.getByLabel(campo, { exact: true }).fill(texto);
});

When("envío mi respuesta de registro", async ({ page }) => {
  await page.getByRole("button", { name: "Enviar mi respuesta", exact: true }).click();
});

When("escribo la contraseña {string}", async ({ page }, clave) => {
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
});

When("pulso {string}", async ({ page }, texto) => {
  await page.getByRole("button", { name: texto, exact: true }).click();
});

When("escribo el nombre del evento {string} con un número único", async ({ page, ctx }, texto) => {
  ctx.numero = Date.now();
  await page.getByLabel("Nombre del evento", { exact: true }).fill(`${texto} ${ctx.numero}`);
});

Then("veo el enlace {string}", async ({ page }, texto) => {
  await expect(page.getByRole("link", { name: texto, exact: true })).toBeVisible();
});

Then("veo a {string} en su propia invitación", async ({ page, ctx }, nombre) => {
  await expect(page.getByText(nombre).first()).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(ctx.genericToken));
  await expect(page).toHaveURL(/\/i\/[\w-]{32}$/);
});

Then("la página pide no indexarla", async ({ page }) => {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

Then("veo el encabezado con el título del evento", async ({ page, ctx }) => {
  await expect(page.getByRole("heading", { name: ctx.titulo })).toBeVisible();
});

Then("el campo {string} sugiere una dirección que empieza por {string}", async ({ page, ctx }, campo, prefijo) => {
  await expect(page.getByLabel(campo, { exact: true })).toHaveValue(`${prefijo}-${ctx.numero}`, { timeout: 10000 });
});
