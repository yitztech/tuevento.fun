import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
import { baseURL, englishURL } from "../support/entorno.js";

const cabecera = { "x-tuevento-client": "1" };
/** Raíz de cada idioma: el español en su dominio; los demás, en el inglés con su prefijo. */
const sitios = { es: baseURL, en: englishURL, pt: `${englishURL}/pt`, de: `${englishURL}/de`, fr: `${englishURL}/fr` };

/** Evento sin dirección escrita: la API la saca del título. */
const eventoNuevo = (titulo) => ({
  title: titulo,
  description: "",
  date: "2027-06-12T18:00:00Z",
  timeZone: "America/Mexico_City",
  location: "Jardín de pruebas",
  theme: "floral",
});

// Con `request`, que no comparte cookies con el navegador ni con la app: quien abre la landing
// después no tiene la sesión del organizador.
Given("que un organizador tiene un evento con una invitación para {string}", async ({ request, ctx }, persona) => {
  const registro = await request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
  expect(registro.status()).toBe(201);
  ctx.codigo = (await registro.json()).publicCode;
  ctx.titulo = `Fiesta de la landing ${Date.now()}`;
  const evento = await request.post("/api/events", { headers: cabecera, data: eventoNuevo(ctx.titulo) });
  expect(evento.status()).toBe(201);
  ctx.evento = await evento.json();
  const invitacion = await request.post(`/api/events/${ctx.evento.id}/invitations`, {
    headers: cabecera,
    data: { name: persona, kind: "individual", email: "", phone: "", notes: "", members: [{ name: persona, kind: "adult", notes: "" }] },
  });
  expect(invitacion.status()).toBe(201);
  ctx.token = (await invitacion.json()).token;
});

Given("que tengo un evento creado sin escribir su dirección", async ({ page, ctx }) => {
  // `page.request` comparte las cookies del navegador: la sesión queda abierta.
  const registro = await page.request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
  expect(registro.status()).toBe(201);
  ctx.codigo = (await registro.json()).publicCode;
  ctx.unico = Date.now();
  ctx.titulo = `Cena de aniversario ${ctx.unico}`;
  const evento = await page.request.post("/api/events", { headers: cabecera, data: eventoNuevo(ctx.titulo) });
  expect(evento.status()).toBe(201);
  ctx.evento = await evento.json();
});

When("abro mi enlace personal de invitado", async ({ ui, ctx }) => {
  await ui.abrir(`/i/${ctx.token}`);
});

When("abro mi enlace personal de invitado en {string}", async ({ page, ctx }, idioma) => {
  await page.goto(`${sitios[idioma]}/i/${ctx.token}`);
});

When("abro la landing del evento sin enlace personal", async ({ page, ctx }) => {
  await page.goto(`/${ctx.codigo}/${ctx.evento.slug}`);
});

When("abro la página del evento desde su panel", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}`);
  await page.getByRole("link", { name: new RegExp(`/${ctx.codigo}/`) }).click();
});

Then("llego a la landing del evento", async ({ ui, ctx }) => {
  await ui.esperarUrl(new RegExp(`/${ctx.codigo}/${ctx.evento.slug}$`));
  await ui.esperarTexto(ctx.titulo);
});

Then("llego a la landing del evento en {string}", async ({ page, ctx }, idioma) => {
  await expect(page).toHaveURL(`${sitios[idioma]}/${ctx.codigo}/${ctx.evento.slug}`);
  await expect(page.getByText(ctx.titulo).first()).toBeVisible();
});

Then("estoy en la landing de mi evento, con una dirección sacada del título", async ({ page, ctx }) => {
  await expect(page).toHaveURL(new RegExp(`/${ctx.codigo}/cena-de-aniversario-${ctx.unico}$`));
});

When("respondo que asistiré", async ({ ui }) => {
  await ui.pulsar("¡Sí, asistiré!");
  await ui.pulsar("Guardar mi respuesta");
});

When("pulso el enlace {string}", async ({ page }, texto) => {
  await page.getByRole("link", { name: texto, exact: true }).click();
});

Then("vuelvo al panel del evento", async ({ page, ctx }) => {
  await expect(page).toHaveURL(new RegExp(`/eventos/${ctx.evento.id}$`));
  await expect(page.getByRole("heading", { name: ctx.titulo })).toBeVisible();
});

Then("no veo el enlace {string}", async ({ page }, texto) => {
  await expect(page.getByRole("link", { name: texto, exact: true })).toHaveCount(0);
});

Then("no veo el título del evento", async ({ page, ctx }) => {
  await expect(page.getByText(ctx.titulo)).toHaveCount(0);
});

When("abro el enlace personal de mi invitado", async ({ page, ctx }) => {
  await page.goto(`/i/${ctx.token}`);
});
