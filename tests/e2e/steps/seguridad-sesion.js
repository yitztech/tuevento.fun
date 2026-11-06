import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { Given, When, Then, nuevaCuenta, registrar } from "./fixtures.js";
import { baseURL } from "../support/entorno.js";

const cabecera = { "x-tuevento-client": "1" };
/** Raíz del repositorio: `docker compose` busca ahí sus archivos. */
const raiz = new URL("../../../", import.meta.url);
const sql = (query) =>
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-c", query], { stdio: "ignore", cwd: raiz });

/** Valor de la cookie de sesión (`session` o `__Host-session`) de una respuesta. */
const cookieDeSesion = (respuesta) => {
  const linea = respuesta
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((c) => /^(__Host-)?session=[^;]+/.test(c));
  expect(linea, "la respuesta no abre sesión").toBeTruthy();
  return { linea, par: linea.split(";")[0] };
};

const entrar = (request, cuenta, contraseña = cuenta.password) =>
  request.post("/api/auth/login", { headers: cabecera, data: { email: cuenta.email, password: contraseña } });

Given("que tengo una cuenta con la sesión abierta en la API", async ({ page, ctx }) => {
  ctx.cuenta = nuevaCuenta();
  const r = await registrar(page.request, "/api/auth/register", { headers: cabecera, data: ctx.cuenta });
  expect(r.status()).toBe(201);
  ctx.registro = r;
});

When("intento entrar con mi correo y una contraseña incorrecta", async ({ request, ctx }) => {
  ctx.intentos = [...(ctx.intentos ?? []), await entrar(request, ctx.cuenta, `${ctx.cuenta.password}-mal`)];
});

When("intento entrar con un correo que no existe", async ({ request, ctx }) => {
  ctx.intentos = [...(ctx.intentos ?? []), await entrar(request, nuevaCuenta())];
});

Then("ambos intentos responden 401 con el mismo código y el mismo mensaje", async ({ ctx }) => {
  const [a, b] = ctx.intentos;
  expect([a.status(), b.status()]).toEqual([401, 401]);
  const [cuerpoA, cuerpoB] = [await a.json(), await b.json()];
  expect(cuerpoA.code).toBe(cuerpoB.code);
  expect(cuerpoA.detail).toBe(cuerpoB.detail);
  expect(cuerpoA.detail).toBeTruthy();
});

When("intento entrar {int} veces con mi correo y una contraseña incorrecta", async ({ request, ctx }, veces) => {
  for (let i = 0; i < veces; i++) ctx.respuesta = await entrar(request, ctx.cuenta, `${ctx.cuenta.password}-mal`);
});

Then("el último intento responde 429 con Retry-After", async ({ ctx }) => {
  expect(ctx.respuesta.status()).toBe(429);
  expect(Number(ctx.respuesta.headers()["retry-after"])).toBeGreaterThan(0);
});

Then("entrar con la contraseña correcta también responde 429", async ({ request, ctx }) => {
  expect((await entrar(request, ctx.cuenta)).status()).toBe(429);
});

When("guardo la cookie de mi sesión", async ({ ctx }) => {
  ctx.cookie = cookieDeSesion(ctx.registro).par;
});

When("cierro la sesión por la API", async ({ page }) => {
  const r = await page.request.post("/api/auth/logout", { headers: cabecera, data: {} });
  expect(r.ok()).toBeTruthy();
});

Then("la API no me reconoce con la cookie guardada", async ({ request, ctx }) => {
  const r = await request.get("/api/auth/me", { headers: { cookie: ctx.cookie } });
  expect(r.status()).toBe(401);
});

When("entro dos veces con mi correo y mi contraseña", async ({ request, playwright, ctx }) => {
  const otro = await playwright.request.newContext({ baseURL });
  ctx.accesos = [await entrar(request, ctx.cuenta), await entrar(otro, ctx.cuenta)];
  await otro.dispose();
});

Then("las dos sesiones tienen cookies distintas", async ({ ctx }) => {
  const [a, b] = ctx.accesos.map((r) => cookieDeSesion(r).par);
  expect(a).not.toBe(b);
});

Then("las dos siguen abiertas", async ({ request, ctx }) => {
  for (const r of ctx.accesos) {
    const respuesta = await request.get("/api/auth/me", { headers: { cookie: cookieDeSesion(r).par } });
    expect(respuesta.status()).toBe(200);
  }
});

When("entro con mi correo y mi contraseña por la API", async ({ request, ctx }) => {
  ctx.respuesta = await entrar(request, ctx.cuenta);
  expect(ctx.respuesta.status()).toBe(201);
});

Then("la cookie de sesión caduca en 7 días como máximo", async ({ ctx }) => {
  const maxAge = Number(/;\s*Max-Age=(\d+)/i.exec(cookieDeSesion(ctx.respuesta).linea)?.[1]);
  expect(maxAge).toBeGreaterThan(0);
  expect(maxAge).toBeLessThanOrEqual(7 * 86400);
});

Then("el cuerpo de la respuesta no incluye datos secretos", async ({ ctx }) => {
  const texto = JSON.stringify(await ctx.respuesta.json());
  expect(texto).not.toMatch(/password|passwordHash|password_hash|token|argon2|google_sub/i);
  expect(texto).not.toContain(ctx.cuenta.password);
});

When("pido {string} sin sesión", async ({ request, ctx }, ruta) => {
  ctx.respuesta = await request.get(ruta);
});

When("envío un cierre de sesión sin la cabecera propia", async ({ request, ctx }) => {
  ctx.respuesta = await request.post("/api/auth/logout", { data: {} });
});

When("envío un cierre de sesión desde el origen {string}", async ({ request, ctx }, origen) => {
  ctx.respuesta = await request.post("/api/auth/logout", { headers: { ...cabecera, origin: origen }, data: {} });
});

Then("la API responde 403 con el código {string}", async ({ ctx }, codigo) => {
  expect(ctx.respuesta.status()).toBe(403);
  expect((await ctx.respuesta.json()).code).toBe(codigo);
});

When("mi sesión lleva {int} horas sin usarse", async ({ ctx }, horas) => {
  const email = ctx.cuenta.email.replace(/'/g, "''");
  sql(`UPDATE sessions SET last_seen_at=now()-interval '${horas} hours' WHERE user_id=(SELECT id FROM users WHERE email='${email}')`);
});

When("pido mi cuenta con mi sesión", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.get("/api/auth/me");
});

When("abro otra sesión en otro dispositivo", async ({ request, ctx }) => {
  const r = await entrar(request, ctx.cuenta);
  expect(r.status()).toBe(201);
  ctx.otraCookie = cookieDeSesion(r).par;
});

When("cierro todas mis sesiones", async ({ page }) => {
  const r = await page.request.post("/api/auth/logout-all", { headers: cabecera, data: {} });
  expect(r.status()).toBe(200);
});

Then("la API no me reconoce en ningún dispositivo", async ({ page, request, ctx }) => {
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  expect((await request.get("/api/auth/me", { headers: { cookie: ctx.otraCookie } })).status()).toBe(401);
});

When("cambio mi contraseña por la API", async ({ page, ctx }) => {
  ctx.nueva = `${ctx.cuenta.password}-nueva`;
  ctx.respuesta = await page.request.post("/api/auth/password/change", {
    headers: cabecera,
    data: { currentPassword: ctx.cuenta.password, newPassword: ctx.nueva },
  });
});

When("cambio mi contraseña por la API con una actual incorrecta", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.post("/api/auth/password/change", {
    headers: cabecera,
    data: { currentPassword: `${ctx.cuenta.password}-mal`, newPassword: `${ctx.cuenta.password}-nueva` },
  });
});

Then("la sesión del otro dispositivo ya no sirve", async ({ request, ctx }) => {
  expect((await request.get("/api/auth/me", { headers: { cookie: ctx.otraCookie } })).status()).toBe(401);
});

Then("mi sesión sigue abierta", async ({ page }) => {
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
});

Then("la contraseña anterior ya no entra", async ({ request, ctx }) => {
  expect((await entrar(request, ctx.cuenta)).status()).toBe(401);
});

Then("la contraseña nueva entra", async ({ request, ctx }) => {
  expect((await entrar(request, ctx.cuenta, ctx.nueva)).status()).toBe(201);
});

When("alguien lo repite con el mismo correo y otra contraseña", async ({ request, ctx }) => {
  ctx.cuenta = ctx.datos;
  ctx.primera = ctx.datos.password;
  ctx.respuesta = await request.post("/api/auth/register", {
    headers: cabecera,
    data: { ...ctx.datos, password: `${ctx.datos.password}-otra` },
  });
});

Then("la primera contraseña ya no entra", async ({ playwright, ctx }) => {
  const limpio = await playwright.request.newContext({ baseURL });
  expect((await entrar(limpio, ctx.cuenta, ctx.primera)).status()).toBe(401);
  await limpio.dispose();
});

When("alguien se registra con mi correo y otra contraseña", async ({ playwright, ctx }) => {
  const limpio = await playwright.request.newContext({ baseURL });
  ctx.respuesta = await limpio.post("/api/auth/register", {
    headers: cabecera,
    data: { ...ctx.cuenta, password: `${ctx.cuenta.password}-otra` },
  });
  await limpio.dispose();
});
