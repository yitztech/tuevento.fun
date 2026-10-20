import { test } from "node:test";
import assert from "node:assert/strict";
import { createUmami, umamiFromEnv } from "./umami.mjs";

const WEBSITE = "a9bab77a-9e00-4815-8007-7a3d3f78b0ab";
const NOW = Date.UTC(2026, 9, 19, 15, 30);

// Umami de mentira: guarda cada llamada y responde según la ruta
function fakeUmami({ tokens = ["t1", "t2"], expireFirst = false, metrics = [{ x: "MX", y: 3 }, { x: "ES", y: 7 }] } = {}) {
  const calls = [];
  let issued = 0;
  let expired = !expireFirst;
  const fetch = async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    const { pathname } = new URL(url);
    if (pathname === "/api/auth/login") {
      return Response.json({ token: tokens[issued++], user: { username: "tuevento" } });
    }
    if (pathname === `/api/websites/${WEBSITE}/metrics`) {
      if (!expired) {
        expired = true;
        return new Response("", { status: 401 });
      }
      return Response.json(metrics);
    }
    return new Response("", { status: 404 });
  };
  return { fetch, calls };
}

const umami = (fake, now = () => NOW) =>
  createUmami({ url: "https://stats.example.com/", username: "tuevento", password: "clave", websiteId: WEBSITE, fetch: fake.fetch, now });

test("entra con el usuario, pide los países del periodo en milisegundos y los ordena", async () => {
  const fake = fakeUmami();
  assert.deepEqual(await umami(fake).countries(7), [
    { country: "ES", visitors: 7 },
    { country: "MX", visitors: 3 },
  ]);
  const [login, metrics] = fake.calls;
  assert.equal(login.url.href, "https://stats.example.com/api/auth/login");
  assert.equal(login.init.method, "POST");
  assert.deepEqual(JSON.parse(login.init.body), { username: "tuevento", password: "clave" });
  assert.equal(metrics.init.headers.Authorization, "Bearer t1");
  assert.equal(metrics.url.searchParams.get("type"), "country");
  assert.equal(metrics.url.searchParams.get("startAt"), String(Date.UTC(2026, 9, 13)));
  assert.equal(metrics.url.searchParams.get("endAt"), String(NOW));
});

test("reutiliza el token y, si Umami lo rechaza, entra otra vez una sola vez", async () => {
  const fake = fakeUmami({ expireFirst: true });
  let t = NOW;
  const client = umami(fake, () => t);
  await client.countries(7);
  t += 10 * 60 * 1000;
  await client.countries(7);
  const logins = fake.calls.filter((c) => c.url.pathname === "/api/auth/login");
  assert.equal(logins.length, 2);
  assert.equal(fake.calls.at(-1).init.headers.Authorization, "Bearer t2");
});

test("guarda el resultado 5 minutos para no consultar Umami en cada recarga", async () => {
  const fake = fakeUmami();
  let t = NOW;
  const client = umami(fake, () => t);
  await client.countries(30);
  t += 60 * 1000;
  await client.countries(30);
  assert.equal(fake.calls.length, 2);
  t += 5 * 60 * 1000;
  await client.countries(30);
  assert.equal(fake.calls.length, 3);
});

test("un error de Umami llega como error, sin datos inventados", async () => {
  const fetch = async () => new Response("", { status: 500 });
  const client = createUmami({ url: "https://stats.example.com", username: "u", password: "p", websiteId: WEBSITE, fetch });
  await assert.rejects(client.countries(7), /Umami respondió 500/);
});

test("sin variables de Umami el panel funciona sin países; con solo algunas no arranca", () => {
  assert.equal(umamiFromEnv({}), null);
  assert.equal(umamiFromEnv({ UMAMI_WEBSITE_ID: WEBSITE }), null);
  assert.throws(() => umamiFromEnv({ UMAMI_API_URL: "https://stats.example.com" }), /UMAMI_API_USER, UMAMI_API_PASSWORD, UMAMI_WEBSITE_ID/);
  const full = { UMAMI_API_URL: "https://stats.example.com", UMAMI_API_USER: "u", UMAMI_API_PASSWORD: "p", UMAMI_WEBSITE_ID: WEBSITE };
  assert.ok(umamiFromEnv(full).countries);
  assert.throws(() => umamiFromEnv({ ...full, UMAMI_API_URL: "stats.example.com" }), /UMAMI_API_URL/);
  assert.throws(() => umamiFromEnv({ ...full, UMAMI_WEBSITE_ID: "" }), /UMAMI_WEBSITE_ID/);
});
