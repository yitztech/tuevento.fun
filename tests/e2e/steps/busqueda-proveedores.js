import { expect } from "@playwright/test";
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
import { baseURL, englishURL, local } from "../support/entorno.js";
import { pngDataUrl, providerData } from "../../api/api.mjs";

const cabecera = { "x-tuevento-client": "1" };
/** Página de búsqueda en cada idioma (packages/contracts/src/i18n.ts), con su dominio. */
const seccion = { es: "/proveedores", en: "/vendors", pt: "/pt/fornecedores", de: "/de/dienstleister", fr: "/fr/prestataires" };
const dominio = (idioma) => (idioma === "es" ? baseURL : englishURL);
const es = JSON.parse(readFileSync(new URL("../../../packages/contracts/src/locales/es.json", import.meta.url), "utf8"));
/** Código de una categoría por su nombre en español («DJ» → dj). */
const categoria = (nombre) => {
  const codigo = Object.entries(es.providers.categories).find(([, texto]) => texto === nombre)?.[0];
  if (!codigo) throw new Error(`Categoría desconocida: ${nombre}`);
  return codigo;
};
/** Código único en minúsculas y sin dígitos sueltos: entra en el nombre y distingue los datos del escenario. */
const codigoUnico = () => `q${randomBytes(5).toString("hex")}`;
/** Punto aleatorio lejos de los de otros escenarios (latitudes medias, cualquier longitud). */
/** Fracción aleatoria en [0, 1) con crypto (Math.random() lo marca CodeQL aunque aquí no sea un secreto). */
const azar = () => randomInt(0, 1_000_000) / 1_000_000;
const puntoUnico = () => ({ lat: -40 + azar() * 80, lng: -170 + azar() * 340 });
/** El punto a `km` kilómetros al norte. */
const alNorte = (p, km) => ({ lat: p.lat + km / 111.32, lng: p.lng });

/** Registra un negocio, completa su perfil con una foto y lo publica. Devuelve sus datos. */
async function publicarNegocio(playwright, extra) {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: cabecera });
  try {
    expect((await api.post("/api/auth/register", { data: { ...nuevaCuenta(), accountType: "provider" } })).status()).toBe(201);
    const datos = providerData({ slug: `${codigoUnico()}-${randomBytes(2).toString("hex")}`, ...extra });
    expect((await api.put("/api/provider/profile", { data: datos })).status()).toBe(200);
    expect((await api.post("/api/provider/images", { data: { dataUrl: pngDataUrl(40, 30), alt: "Portada" } })).status()).toBe(201);
    expect((await api.post("/api/provider/publish", { data: {} })).status()).toBe(200);
    return datos;
  } finally {
    await api.dispose();
  }
}

/** Tarjetas de resultados cuyo nombre lleva el código del escenario. */
const tarjetas = (page, codigo) => page.getByRole("listitem").filter({ has: page.getByText(codigo) }).locator("strong");

Given("que hay un negocio publicado llamado {string}", async ({ playwright, ctx }, nombre) => {
  ctx.codigo = codigoUnico();
  ctx.negocio = await publicarNegocio(playwright, { businessName: `${nombre} ${ctx.codigo}` });
});

Given("que hay {int} negocios publicados llamados {string}", async ({ playwright, ctx }, n, nombre) => {
  ctx.codigo = codigoUnico();
  ctx.nombre = `${nombre} ${ctx.codigo}`;
  // De 7 en 7: rápido sin saturar la API
  for (let i = 0; i < n; i += 7)
    await Promise.all(
      Array.from({ length: Math.min(7, n - i) }, (_, j) =>
        publicarNegocio(playwright, { businessName: `${ctx.nombre} ${i + j + 1}` }),
      ),
    );
});

Given("que hay un negocio de {string} y otro de {string} con el mismo nombre", async ({ playwright, ctx }, a, b) => {
  ctx.codigo = codigoUnico();
  ctx.nombre = `Fiesta Total ${ctx.codigo}`;
  ctx.porCategoria = {};
  for (const nombre of [a, b])
    ctx.porCategoria[nombre] = await publicarNegocio(playwright, { businessName: `${ctx.nombre} ${nombre}`, categories: [categoria(nombre)] });
});

Given("que hay un negocio a {int} km de mí y otro a {int} km", async ({ playwright, page, ctx }, cerca, lejos) => {
  ctx.codigo = codigoUnico();
  ctx.yo = puntoUnico();
  ctx.lejanos = {};
  for (const km of [cerca, lejos])
    ctx.lejanos[km] = await publicarNegocio(playwright, {
      businessName: `Salón Jardín ${ctx.codigo} ${km}`,
      geo: alNorte(ctx.yo, km),
      addressVisibility: "exact",
    });
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: ctx.yo.lat, longitude: ctx.yo.lng });
});

When("busco su nombre escrito como {string} en la página de proveedores", async ({ ui, ctx }, texto) => {
  await ui.abrir(seccion.es);
  await ui.escribir("¿Qué buscas?", `${texto} ${ctx.codigo}`);
  await ui.pulsar("Buscar");
});

When("busco un texto que ningún negocio tiene en la página de proveedores", async ({ ui }) => {
  await ui.abrir(seccion.es);
  await ui.escribir("¿Qué buscas?", `sinresultados${codigoUnico()}`);
  await ui.pulsar("Buscar");
});

When("busco ese nombre en la página de proveedores", async ({ ui, ctx }) => {
  await ui.abrir(seccion.es);
  await ui.escribir("¿Qué buscas?", ctx.nombre);
  await ui.pulsar("Buscar");
});

When("abro la página de proveedores y busco cerca de mí", async ({ ui }) => {
  await ui.abrir(seccion.es);
  await ui.pulsar("Cerca de mí");
});

When("abro la página de proveedores en {string}", async ({ page }, idioma) => {
  await page.goto(`${dominio(idioma)}${seccion[idioma]}`);
});

Then("veo su tarjeta en los resultados", async ({ ui, ctx }) => {
  await ui.esperarTexto(ctx.negocio.businessName);
});

Then("veo que no hay proveedores con esos filtros", async ({ ui }) => {
  await ui.esperarTexto(es.providerSearch.emptyTitle);
});

When("quito los filtros", async ({ ui }) => {
  await ui.pulsar(es.providerSearch.clearFilters);
});

Then("veo {int} tarjetas de ese nombre", async ({ page, ctx }, n) => {
  await expect(tarjetas(page, ctx.codigo)).toHaveCount(n);
});

Then("veo solo la tarjeta del negocio de {string}", async ({ page, ctx }, nombre) => {
  await expect(tarjetas(page, ctx.codigo)).toHaveText([ctx.porCategoria[nombre].businessName]);
});

Then("la dirección de la página lleva la categoría {string}", async ({ page }, codigo) => {
  await expect(page).toHaveURL(new RegExp(`[?&]cat=${codigo}(&|$)`));
});

Then("veo la tarjeta del negocio a {int} km con su distancia", async ({ page, ctx }, km) => {
  const tarjeta = page.getByRole("listitem").filter({ hasText: ctx.lejanos[km].businessName });
  await expect(tarjeta).toBeVisible();
  // Coordenadas exactas: la distancia es la real, redondeada
  await expect(tarjeta).toContainText(new RegExp(`A ${km}(,\\d)? km`));
});

Then("no veo la tarjeta del negocio a {int} km", async ({ page, ctx }, km) => {
  await expect(page.getByRole("heading", { name: es.providerSearch.results })).toBeVisible();
  await expect(page.getByText(ctx.lejanos[km].businessName)).toHaveCount(0);
});

When("amplío la distancia a {string}", async ({ page }, opcion) => {
  await page.getByLabel(es.providerSearch.radius, { exact: true }).selectOption({ label: opcion });
});

Then("veo la tarjeta del negocio a {int} km", async ({ page, ctx }, km) => {
  await expect(page.getByText(ctx.lejanos[km].businessName)).toBeVisible();
});

When("cargo más resultados", async ({ page }) => {
  await page.getByRole("button", { name: es.providerSearch.loadMore }).click();
});

Then("veo {int} tarjetas de ese nombre, sin repetidas", async ({ page, ctx }, n) => {
  const nombres = tarjetas(page, ctx.codigo);
  await expect(nombres).toHaveCount(n);
  expect(new Set(await nombres.allTextContents()).size).toBe(n);
});

Then("veo el título {string}", async ({ page }, titulo) => {
  await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
});

Then("veo la categoría {string}", async ({ page }, nombre) => {
  await expect(page.getByRole("checkbox", { name: nombre, exact: true })).toBeVisible();
});

Then("el canonical es {string} sin parámetros", async ({ ctx }, ruta) => {
  const canonical = (await ctx.respuesta.text()).match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
  const url = new URL(canonical, ctx.dominio);
  expect(url.pathname).toBe(ruta);
  expect(url.search).toBe("");
  if (!local) expect(url.origin).toBe(new URL(ctx.dominio).origin);
});

Then(
  "el sitemap lista {string}, {string}, {string} y {string}",
  async ({ ctx }, a, b, c, d) => {
    const rutas = [a, b, c, d];
    expect(ctx.respuesta.status()).toBe(200);
    const locs = [...(await ctx.respuesta.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    for (const ruta of rutas) expect(locs, ruta).toContain(ruta);
  },
);
