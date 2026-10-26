// Pasos de features/plataforma/: salud, dominios e idiomas, páginas legales, errores de la API
// (Problem Details), cookies y accesibilidad. Comunes a todos los proyectos de la plataforma.
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";
import { baseURL, englishURL, local } from "../support/entorno.js";

const cabecera = { "x-tuevento-client": "1" };
/** Idiomas alojados en el dominio inglés bajo un prefijo (yourevent.fun/pt). */
const alojados = ["pt", "de", "fr"];

/** URL de una ruta en el dominio de un idioma: es en el principal, en en el suyo, pt/de/fr con prefijo. */
function urlEn(idioma, ruta) {
  if (idioma === "es") return `${baseURL}${ruta}`;
  if (idioma === "en" || !alojados.includes(idioma)) return `${englishURL}${ruta}`;
  return `${englishURL}/${idioma}${ruta === "/" ? "/" : ruta}`;
}
/** Dominio que sirve un idioma (sin el prefijo de los alojados). */
const dominioDe = (idioma) => (idioma === "es" ? baseURL : englishURL);

const catalogo = (idioma) =>
  JSON.parse(readFileSync(new URL(`../../../packages/contracts/src/locales/${idioma}.json`, import.meta.url), "utf8"));
const mensaje = (idioma, clave) => clave.split(".").reduce((o, k) => o?.[k], catalogo(idioma));

// ── Salud y versión ──────────────────────────────────────────────

When("pido la salud de la API", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.get("/api/health");
});

Then("la salud responde solo el estado {string}", async ({ ctx }, estado) => {
  expect(await ctx.respuesta.json()).toEqual({ status: estado });
});

When("pido la versión publicada", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.get("/version.json");
});

Then("la versión trae la revisión desplegada", async ({ ctx }) => {
  expect(ctx.respuesta.status()).toBe(200);
  const { revision } = await ctx.respuesta.json();
  // Contra producción, E2E_REVISION es el commit que se acaba de desplegar
  if (process.env.E2E_REVISION) expect(revision).toBe(process.env.E2E_REVISION);
  else expect(revision).toMatch(/^[\w.-]+$/);
});

// ── Dominios, idioma y cabeceras ─────────────────────────────────

When("abro la portada en {string}", async ({ page, ctx }, idioma) => {
  ctx.respuesta = await page.goto(urlEn(idioma, "/"));
});

When("abro la página {string} en {string}", async ({ page, ctx }, ruta, idioma) => {
  ctx.respuesta = await page.goto(urlEn(idioma, ruta));
});

When("abro {string} en el dominio en {string}", async ({ page, ctx }, ruta, idioma) => {
  // Ruta tal cual en el dominio del idioma (sin añadir su prefijo)
  ctx.respuesta = await page.goto(`${dominioDe(idioma)}${ruta}`);
});

/** El HTML tal como lo sirve el servidor, antes de que la SPA lo cambie. */
const htmlInicial = async (ctx) => ctx.respuesta.text();

Then("el HTML inicial está en {string}", async ({ ctx }, idioma) => {
  expect(await htmlInicial(ctx)).toContain(`<html lang="${idioma}"`);
});

Then("el título del HTML inicial es {string}", async ({ ctx }, titulo) => {
  expect(await htmlInicial(ctx)).toContain(`<title>${titulo}</title>`);
});

Then("la descripción del HTML inicial empieza por {string}", async ({ ctx }, inicio) => {
  const html = await htmlInicial(ctx);
  expect(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "").toMatch(new RegExp(`^${inicio}`));
});

Then("el enlace canonical apunta a la portada en {string}", async ({ ctx }, idioma) => {
  const html = await htmlInicial(ctx);
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  expect(canonical && new URL(canonical).pathname).toBe(new URL(urlEn(idioma, "/")).pathname);
});

Then("la página lleva las cabeceras de seguridad", async ({ ctx }) => {
  const h = ctx.respuesta.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
  expect(h["referrer-policy"]).toBeTruthy();
  expect(h["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
  expect(h["content-security-policy"]).toMatch(/object-src 'none'/);
});

Then("la respuesta fue una redirección {int}", async ({ ctx }, estado) => {
  const anterior = ctx.respuesta.request().redirectedFrom();
  expect(anterior, "no hubo redirección").toBeTruthy();
  expect((await anterior.response()).status()).toBe(estado);
});

Then("estoy en la portada en {string}", async ({ page }, idioma) => {
  expect(page.url()).toBe(urlEn(idioma, "/"));
});

Then("la página responde {int} con un título principal", async ({ page, ctx }, estado) => {
  expect(ctx.respuesta.status()).toBe(estado);
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
});

// ── Errores de la API ────────────────────────────────────────────

/** Petición a la API desde la página de un idioma: el dominio decide el idioma, como en la web. */
async function pedirDesde(page, idioma, ruta, { method = "GET", body } = {}) {
  await page.goto(urlEn(idioma, "/"));
  return page.evaluate(
    async ({ ruta, method, body, idioma, alojado }) => {
      const r = await fetch(ruta, {
        method,
        headers: {
          "X-TuEvento-Client": "1",
          // La SPA indica el idioma de la página si su dominio lo aloja (/pt, /de, /fr)
          ...(alojado ? { "X-App-Locale": idioma } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: r.status,
        headers: Object.fromEntries(r.headers.entries()),
        body: await r.json().catch(() => null),
      };
    },
    { ruta, method, body, idioma, alojado: alojados.includes(idioma) },
  );
}

When("desde la portada en {string} pido a la API {string}", async ({ page, ctx }, idioma, ruta) => {
  ctx.problema = await pedirDesde(page, idioma, ruta);
});

When("desde la portada en {string} me registro con el nombre {string}", async ({ page, ctx }, idioma, nombre) => {
  ctx.problema = await pedirDesde(page, idioma, "/api/auth/register", {
    method: "POST",
    body: nuevaCuenta({ firstName: nombre }),
  });
});

When("envío a la API una escritura con el origen {string}", async ({ page, ctx }, origen) => {
  const r = await page.request.post("/api/newsletter/subscribe", {
    headers: { ...cabecera, Origin: origen },
    data: { email: nuevaCuenta().email },
  });
  ctx.problema = { status: r.status(), headers: r.headers(), body: await r.json() };
});

Given("que tengo una cuenta creada por la API", async ({ page }) => {
  const r = await page.request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
  expect(r.status()).toBe(201);
});

Then("la API responde {int} en Problem Details con el código {string}", async ({ ctx }, estado, codigo) => {
  const { status, headers, body } = ctx.problema;
  expect(status).toBe(estado);
  expect(headers["content-type"]).toMatch(/^application\/problem\+json/);
  expect(body).toMatchObject({ type: "about:blank", status: estado, code: codigo });
  expect(body.title).toBeTruthy();
  expect(body.detail).toBeTruthy();
  expect(body.requestId).toBe(headers["x-request-id"]);
});

Then("el título del error es {string}", async ({ ctx }, titulo) => {
  expect(ctx.problema.body.title).toBe(titulo);
});

Then("la respuesta trae el idioma {string}", async ({ ctx }, idioma) => {
  expect(ctx.problema.headers["content-language"]).toBe(idioma);
});

Then(
  "el campo {string} tiene el código {string} y el mensaje de {string} en {string}",
  async ({ ctx }, campo, codigo, clave, idioma) => {
    expect(ctx.problema.body.errors).toContainEqual({ field: campo, code: codigo, message: mensaje(idioma, clave) });
  },
);

When("me suscribo al boletín {int} veces con el mismo correo", async ({ page, ctx }, veces) => {
  const { email } = nuevaCuenta();
  for (let i = 0; i < veces; i++)
    ctx.respuesta = await page.request.post("/api/newsletter/subscribe", { headers: cabecera, data: { email } });
});

Then("la última respuesta es {int} con Retry-After", async ({ ctx }, estado) => {
  expect(ctx.respuesta.status()).toBe(estado);
  expect(Number(ctx.respuesta.headers()["retry-after"])).toBeGreaterThan(0);
  expect((await ctx.respuesta.json()).code).toBe("rate_limited");
});

// ── Cookies ──────────────────────────────────────────────────────

When("creo una cuenta por la API", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
  expect(ctx.respuesta.status()).toBe(201);
});

When("pido un nonce de acceso con Google", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.post("/api/auth/google/nonce", { headers: cabecera, data: {} });
  expect(ctx.respuesta.status()).toBe(201);
});

Then("la cookie {string} cumple las reglas de la plataforma", async ({ ctx }, nombre) => {
  const cookies = ctx.respuesta.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
  const cookie = cookies.find((c) => c.startsWith(`__Host-${nombre}=`) || c.startsWith(`${nombre}=`));
  expect(cookie, `sin cookie ${nombre}: ${cookies.join(" | ")}`).toBeTruthy();
  expect(cookie).toMatch(/;\s*HttpOnly/i);
  expect(cookie).toMatch(/;\s*SameSite=Lax/i);
  expect(cookie).toMatch(/;\s*Path=\/(;|$)/i);
  expect(cookie).not.toMatch(/;\s*Domain=/i);
  // Con HTTPS (producción) el nombre lleva __Host- y la cookie es Secure
  if (baseURL.startsWith("https://")) {
    expect(cookie.startsWith(`__Host-${nombre}=`)).toBe(true);
    expect(cookie).toMatch(/;\s*Secure/i);
  }
});

// ── Accesibilidad ────────────────────────────────────────────────

Then("axe no encuentra infracciones graves ni críticas", async ({ page }) => {
  // Se espera a que la SPA pinte la página
  await expect(page.getByRole("heading").first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    graves.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
});

// ── Indexación (AGENTS.md §9.2) ──────────────────────────────────

When("pido {string} en el dominio en {string}", async ({ page, ctx }, ruta, idioma) => {
  ctx.dominio = dominioDe(idioma);
  ctx.respuesta = await page.request.get(`${ctx.dominio}${ruta}`, { maxRedirects: 0 });
});

Then("la respuesta es {int}", async ({ ctx }, estado) => {
  expect(ctx.respuesta.status()).toBe(estado);
});

Then("la respuesta es {int} hacia {string}", async ({ ctx }, estado, destino) => {
  expect(ctx.respuesta.status()).toBe(estado);
  // Relativa o absoluta, nunca a http:// si la petición era https://
  const location = ctx.respuesta.headers().location ?? "";
  expect(new URL(location, ctx.dominio).pathname).toBe(destino);
  expect(location.startsWith("http://") && ctx.dominio.startsWith("https://")).toBe(false);
});

Then("la respuesta lleva X-Robots-Tag noindex", async ({ ctx }) => {
  expect(ctx.respuesta.headers()["x-robots-tag"] ?? "").toMatch(/noindex/);
});

Then("el HTML no lleva canonical", async ({ ctx }) => {
  expect(await ctx.respuesta.text()).not.toMatch(/rel="canonical"/);
});

Then("robots.txt no lleva Disallow y apunta a su sitemap", async ({ ctx }) => {
  expect(ctx.respuesta.headers()["content-type"]).toMatch(/^text\/plain/);
  const texto = await ctx.respuesta.text();
  expect(texto).not.toMatch(/^Disallow:\s*\S/im);
  expect(texto).toMatch(/^Sitemap: \S+\/sitemap\.xml$/m);
});

Then("cada URL del sitemap responde 200 sin noindex y con su canonical", async ({ page, ctx }) => {
  expect(ctx.respuesta.status()).toBe(200);
  const urls = [...(await ctx.respuesta.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    // Las <loc> llevan el dominio público (SITE_URL_*); se piden al dominio en prueba
    const { pathname } = new URL(url);
    const respuesta = await page.request.get(`${ctx.dominio}${pathname}`, { maxRedirects: 0 });
    expect(respuesta.status(), url).toBe(200);
    expect(respuesta.headers()["x-robots-tag"] ?? "", url).not.toMatch(/noindex/);
    const html = await respuesta.text();
    expect(html, url).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
    // En local el origen del canonical sigue al Host pedido; en producción, idéntico a la <loc>
    if (local) expect(new URL(canonical, ctx.dominio).pathname, url).toBe(pathname);
    else expect(canonical, url).toBe(url);
  }
});
