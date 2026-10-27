import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
import { baseURL, englishURL, local } from "../support/entorno.js";
import { pngDataUrl, providerData } from "../../api/api.mjs";

const cabecera = { "x-tuevento-client": "1" };
/** Raíz del repositorio: `docker compose` busca ahí sus archivos (y COMPOSE_FILE es relativo a ella). */
const raiz = new URL("../../../", import.meta.url);
/** Texto del HTML con sus referencias numéricas (&#183;) resueltas. */
const sinEntidades = (html) => html.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
/** Sección de proveedores y dominio de cada idioma (packages/contracts/src/i18n.ts). */
const seccion = { es: "/proveedores", en: "/vendors", pt: "/pt/fornecedores", de: "/de/dienstleister", fr: "/fr/prestataires" };
const dominio = (idioma) => (idioma === "es" ? baseURL : englishURL);
const pagina = (idioma, slug) => `${dominio(idioma)}${seccion[idioma]}/${slug}`;
const catalogo = (idioma) =>
  JSON.parse(readFileSync(new URL(`../../../packages/contracts/src/locales/${idioma}.json`, import.meta.url), "utf8"));

Given("que hay un proveedor publicado con 2 fotos", async ({ playwright, ctx }) => {
  // Contexto propio: el navegador del escenario entra como visitante, sin la sesión del negocio
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: cabecera });
  const cuenta = { ...nuevaCuenta(), accountType: "provider" };
  expect((await api.post("/api/auth/register", { data: cuenta })).status()).toBe(201);
  const slug = `negocio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const datos = providerData({ businessName: `Banquetes Lupita ${slug.slice(8)}`, slug });
  expect((await api.put("/api/provider/profile", { data: datos })).status()).toBe(200);
  for (const alt of ["Mesa de banquete", "Pastel de bodas"])
    expect((await api.post("/api/provider/images", { data: { dataUrl: pngDataUrl(40, 30), alt } })).status()).toBe(201);
  expect((await api.post("/api/provider/publish", { data: {} })).status()).toBe(200);
  Object.assign(ctx, { api, cuenta, datos, slug });
});

When("abro su página en {string}", async ({ page, ctx }, idioma) => {
  await page.goto(pagina(idioma, ctx.slug));
});

Then("veo el nombre del negocio como título principal", async ({ page, ctx }) => {
  await expect(page.getByRole("heading", { level: 1, name: ctx.datos.businessName })).toBeVisible();
});

Then("el botón de WhatsApp abre el chat del negocio con el mensaje en {string}", async ({ page, ctx }, idioma) => {
  const textos = catalogo(idioma);
  const enlace = page.getByRole("link", { name: textos.providerPage.whatsapp });
  const url = new URL(await enlace.getAttribute("href"));
  expect(url.origin + url.pathname).toBe("https://wa.me/527771234567");
  expect(url.searchParams.get("text")).toBe(textos.providers.whatsappMessage.replace("{{name}}", ctx.datos.businessName));
  await expect(enlace).toHaveAttribute("target", "_blank");
});

When("abro la foto {int} de la galería", async ({ page }, n) => {
  await page.getByRole("button", { name: `Ver la foto ${n} de 2` }).click();
});

Then("veo el visor {string}", async ({ page }, titulo) => {
  await expect(page.getByRole("dialog", { name: titulo })).toBeVisible();
});

When("pulso la tecla {string}", async ({ page }, tecla) => {
  await page.keyboard.press(tecla);
});

Then("el visor está cerrado y el foco está en la foto {int} de la galería", async ({ page }, n) => {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Ver la foto ${n} de 2` })).toBeFocused();
});

When("pido su página en el dominio en {string}", async ({ page, ctx }, idioma) => {
  ctx.dominio = dominio(idioma);
  ctx.url = pagina(idioma, ctx.slug);
  ctx.respuesta = await page.request.get(ctx.url, { maxRedirects: 0 });
});

Then("el HTML lleva el nombre del negocio en el título y su propia URL como canonical", async ({ ctx }) => {
  const html = sinEntidades(await ctx.respuesta.text());
  // Sin JavaScript: el título y el canonical ya vienen en la respuesta del servidor
  expect(html).toContain(`<title>${ctx.datos.businessName} · `);
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
  if (local) expect(new URL(canonical).pathname).toBe(new URL(ctx.url).pathname);
  else expect(canonical).toBe(ctx.url);
  expect(html).toMatch(/<meta property="og:image" content="[^"]+\/api\/public\/providers\/images\/[0-9a-f-]+\/1600"/);
  expect(ctx.respuesta.headers()["x-robots-tag"] ?? "").not.toMatch(/noindex/);
});

When("el negocio cambia la dirección de su página", async ({ ctx }) => {
  ctx.anterior = ctx.slug;
  ctx.slug = `${ctx.slug}-nueva`;
  expect((await ctx.api.put("/api/provider/profile", { data: { ...ctx.datos, slug: ctx.slug } })).status()).toBe(200);
});

When("pido su dirección anterior en el dominio en {string}", async ({ page, ctx }, idioma) => {
  ctx.dominio = dominio(idioma);
  ctx.respuesta = await page.request.get(pagina(idioma, ctx.anterior), { maxRedirects: 0 });
});

Then("la respuesta es 301 hacia su dirección nueva", async ({ ctx }) => {
  expect(ctx.respuesta.status()).toBe(301);
  expect(new URL(ctx.respuesta.headers().location ?? "", ctx.dominio).pathname).toBe(`${seccion.es}/${ctx.slug}`);
});

When("el negocio despublica su página", async ({ ctx }) => {
  expect((await ctx.api.post("/api/provider/unpublish", { data: {} })).status()).toBe(200);
});

When("se borra la cuenta del negocio", async ({ ctx }) => {
  // Aún no hay un endpoint para borrar la cuenta: se borra en la base de datos, como lo haría la plataforma
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-c",
    `DELETE FROM users WHERE email = '${ctx.cuenta.email.replace(/'/g, "''")}'`], { stdio: "ignore", cwd: raiz });
});

Then(
  "el sitemap lista su página en {string}, {string}, {string} y {string} y cada una responde 200 con su canonical",
  async ({ page, ctx }, a, b, c, d) => {
    const idiomas = [a, b, c, d];
    expect(ctx.respuesta.status()).toBe(200);
    const locs = [...(await ctx.respuesta.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const idioma of idiomas) {
      const ruta = `${seccion[idioma]}/${ctx.slug}`;
      const loc = locs.find((l) => new URL(l).pathname === ruta);
      expect(loc, ruta).toBeTruthy();
      const respuesta = await page.request.get(`${ctx.dominio}${ruta}`, { maxRedirects: 0 });
      expect(respuesta.status(), ruta).toBe(200);
      const canonical = (await respuesta.text()).match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
      if (local) expect(new URL(canonical).pathname, ruta).toBe(ruta);
      else expect(canonical, ruta).toBe(loc);
    }
  },
);
