import { createHash, randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { Given, When, Then, registrar } from "./fixtures.js";
import { baseURL as spanishURL, englishURL } from "../support/entorno.js";

// Conectar un asistente (conectar-asistente.feature). El cliente fijo vuelve a una URL local que no
// existe: se lee de la petición lo que recibiría el asistente (`page.route` no ve las redirecciones).
const callback = "http://127.0.0.1/callback";
const dominio = (idioma) => (idioma === "es" ? spanishURL : englishURL);

const autorizacion = (idioma) =>
  `${dominio(idioma)}/api/mcp/oauth/auth?${new URLSearchParams({
    client_id: "tuevento-pruebas",
    redirect_uri: callback,
    response_type: "code",
    scope: "mcp:read",
    ui_locales: idioma,
    code_challenge: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url"),
    code_challenge_method: "S256",
  })}`;

Given("que un asistente pide acceso a mi cuenta sin que yo haya entrado", async ({ page, ctx, baseURL }) => {
  page.on("request", (peticion) => {
    if (peticion.url().startsWith(`${callback}?`)) ctx.retornoAsistente = peticion.url();
  });
  const query = new URLSearchParams({
    client_id: "tuevento-pruebas",
    redirect_uri: callback,
    response_type: "code",
    scope: "mcp:read",
    state: randomBytes(8).toString("hex"),
    code_challenge: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url"),
    code_challenge_method: "S256",
  });
  ctx.estadoAsistente = query.get("state");
  await page.goto(`${baseURL}/api/mcp/oauth/auth?${query}`);
  await expect(page).toHaveURL(/\/acceso\?asistente=/);
});

Given("que abro un enlace de conexión de asistente que ya no vale", async ({ ui }) => {
  await ui.abrir("/conectar-asistente?uid=caducado");
  await ui.esperarUrl(/\/acceso\?asistente=caducado/);
});

When("entro con mi cuenta para conectar el asistente", async ({ ui, ctx, request }) => {
  const correo = `asistente-${randomBytes(6).toString("hex")}@example.invalid`;
  const clave = randomBytes(16).toString("hex");
  const alta = await registrar(request, "/api/auth/register", {
    headers: { "x-tuevento-client": "1" },
    data: { firstName: "Ana", lastName: "Prueba", email: correo, phone: "+527770000000", password: clave, accountType: "organizer" },
  });
  expect(alta.status()).toBe(201);
  ctx.correoAsistente = correo;
  await ui.escribir("Correo electrónico", correo);
  await ui.escribir("Contraseña", clave);
  await ui.pulsar("Entrar a mi espacio");
  await ui.esperarUrl(/\/conectar-asistente\?uid=/);
});

Then("veo que {string} solo podrá consultar mis datos", async ({ ui, ctx }, cliente) => {
  await ui.esperarTexto(`${cliente} quiere acceder a tu cuenta de TuEventoFun.`);
  await ui.esperarTexto("Solo podrá consultar tus datos. No podrá crear, cambiar ni borrar nada.");
  await ui.esperarTexto(ctx.correoAsistente);
});

Given("que tengo sesión en el dominio de {string}", async ({ page }, idioma) => {
  const origen = dominio(idioma);
  const alta = await registrar(page.request, `${origen}/api/auth/register`, {
    headers: { "x-tuevento-client": "1", origin: origen },
    data: {
      firstName: "Ana",
      lastName: "Prueba",
      email: `asistente-${randomBytes(6).toString("hex")}@example.invalid`,
      phone: "+527770000000",
      accountType: "organizer",
      password: randomBytes(16).toString("hex"),
    },
  });
  expect(alta.status()).toBe(201);
});

When("un asistente pide acceso en {string}", async ({ page }, idioma) => {
  await page.goto(autorizacion(idioma));
});

Given("que un asistente pide acceso en {string} sin que yo haya entrado", async ({ page }, idioma) => {
  await page.goto(autorizacion(idioma));
});

Then("veo el consentimiento en {string} con el título {string}", async ({ page }, ruta, titulo) => {
  await expect(page).toHaveURL((url) => url.pathname === ruta);
  await expect(page.getByRole("heading", { name: titulo, exact: true })).toBeVisible();
});

Then("veo el acceso en {string} para conectar el asistente", async ({ page }, ruta) => {
  await expect(page).toHaveURL((url) => url.pathname === ruta && url.searchParams.has("asistente"));
});

/** Parámetros con los que el navegador vuelve al asistente. */
async function retorno(ctx) {
  await expect.poll(() => ctx.retornoAsistente).toBeTruthy();
  return new URL(ctx.retornoAsistente).searchParams;
}

Then("el asistente recibe un código de autorización", async ({ ctx }) => {
  const params = await retorno(ctx);
  expect(params.get("code")).toBeTruthy();
  expect(params.get("state")).toBe(ctx.estadoAsistente);
});

Then("el asistente recibe el rechazo", async ({ ctx }) => {
  const params = await retorno(ctx);
  expect(params.get("error")).toBe("access_denied");
  expect(params.get("code")).toBeNull();
});
