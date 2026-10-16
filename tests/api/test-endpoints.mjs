// Endpoints sin cobertura en test-api.mjs, idiomas (es, en, pt, de, fr) y validación de
// entradas. Corre contra la API real: local (Docker) y GitHub Actions.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { translate, supportedLocales } from "@tuevento/contracts";
import { client, account, cleanup, englishHost, spanishHost, suiteRunner, eventData, invitationData } from "./api.mjs";

const { suite, records } = suiteRunner();
const P = "qa-ep";
try {
  const guest = client();

  await suite("GET /config expone solo lo público", async () => {
    const config = await guest.call("/config");
    assert.deepEqual(Object.keys(config).sort(), ["demoEnabled", "googleClientId"]);
    assert.equal(typeof config.demoEnabled, "boolean");
    assert.equal(typeof config.googleClientId, "string");
  });

  await suite("Acceso demo: sesión de demostración sin privilegios", async () => {
    const { demoEnabled } = await guest.call("/config");
    if (!demoEnabled) return void (await client().call("/auth/demo", "POST", {}, 404));
    const demo = client();
    const user = await demo.call("/auth/demo", "POST", {}, 201);
    assert.equal(user.isDemo, true);
    assert.equal(user.isOwner, false);
    assert.ok(demo.cookie().startsWith("session="));
    await demo.call("/owner/metrics", "GET", undefined, 403);
    // La cuenta demo no puede entrar con contraseña
    await client().call("/auth/login", "POST", { email: user.email, password: "cualquiera-123" }, 401);
  });

  await suite("Verificación de App Links: 404 sin configurar o formato válido", async () => {
    const android = await guest.raw("/.well-known/assetlinks.json");
    if (android.status === 200) {
      const fp = android.data[0].target.sha256_cert_fingerprints;
      assert.ok(fp.length && fp.every((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)));
    } else assert.equal(android.status, 404);
    const apple = await guest.raw("/.well-known/apple-app-site-association");
    if (apple.status === 200) assert.match(apple.data.applinks.details[0].appIDs[0], /^[A-Z0-9]{10}\./);
    else assert.equal(apple.status, 404);
  });

  await suite("Google: nonce con cookie HttpOnly y credenciales inválidas rechazadas", async () => {
    const r = await guest.raw("/auth/google/nonce", { method: "POST", body: {} });
    assert.equal(r.status, 201);
    assert.ok(r.data.nonce.length >= 20);
    assert.match(r.setCookie.join(";"), /google_nonce=/);
    assert.match(r.setCookie.join(";"), /HttpOnly/i);
    const bad = await guest.raw("/auth/google", { method: "POST", body: { credential: "no-es-un-jwt", nonce: r.data.nonce } });
    // 503 si el entorno no tiene GOOGLE_CLIENT_ID (CI); 400 o 401 si lo tiene
    assert.ok([400, 401, 503].includes(bad.status), `credencial falsa → ${bad.status}`);
    assert.equal((await guest.raw("/auth/google", { method: "POST", body: { credential: "x" } })).status, 400);
    assert.equal((await guest.raw("/auth/google", { method: "POST", body: { credential: "x".repeat(12001), nonce: r.data.nonce } })).status, 400);
  });

  await suite("Idiomas es, en, pt, de, fr: el idioma de la cuenta y de los mensajes", async () => {
    assert.deepEqual([...supportedLocales].sort(), ["de", "en", "es", "fr", "pt"]);
    // dominio español → es; dominio inglés → en; y pt/de/fr los aloja el dominio inglés (/pt, /de, /fr)
    const casos = [
      { locale: "es", headers: { Host: spanishHost } },
      { locale: "en", headers: { Host: englishHost } },
      { locale: "pt", headers: { Host: englishHost, "X-App-Locale": "pt" } },
      { locale: "de", headers: { Host: englishHost, "X-App-Locale": "de" } },
      { locale: "fr", headers: { Host: englishHost, "X-App-Locale": "fr" } },
      // Las apps móviles piden cualquier idioma sobre el dominio principal
      { locale: "de", headers: { Host: spanishHost, "X-App-Locale": "de", "X-Client-Platform": "android" } },
    ];
    let n = 0;
    for (const { locale, headers } of casos) {
      const c = client();
      const created = await c.call("/auth/register", "POST", account(P, `loc${n++}`), 201, headers);
      assert.equal(created.locale, locale, `registro con ${JSON.stringify(headers)}`);
      assert.equal((await c.call("/auth/me")).locale, locale);
      // El mensaje de error llega en el idioma de la petición
      const r = await client().raw("/auth/register", { method: "POST", body: { email: "mal" }, headers });
      assert.equal(r.status, 400);
      assert.equal(r.headers["content-language"], locale);
      assert.ok(JSON.stringify(r.data).includes(translate(locale, "validation.enterValidEmailAddress")), `${locale}: ${r.text}`);
    }
    // Un idioma que el dominio no aloja se ignora (no se puede forzar pt desde el dominio español en la web)
    const web = await client().call("/auth/register", "POST", account(P, "loc-web"), 201, { Host: spanishHost, "X-App-Locale": "pt" });
    assert.equal(web.locale, "es");
    // Un idioma desconocido no rompe nada
    const raro = await client().call("/auth/register", "POST", account(P, "loc-raro"), 201, { Host: englishHost, "X-App-Locale": "xx" });
    assert.equal(raro.locale, "en");
  });

  await suite("Validación de entradas: lo inválido responde 400 con el campo", async () => {
    const a = client();
    await a.call("/auth/register", "POST", account(P, "val"), 201);
    const largo = (n, c = "a") => c.repeat(n);
    const mal = async (path, method, body, campo) => {
      const r = await a.raw(path, { method, body });
      assert.equal(r.status, 400, `${method} ${path} ${JSON.stringify(body).slice(0, 80)} → ${r.status} ${r.text.slice(0, 120)}`);
      if (campo) assert.ok(r.data.fields?.[campo], `falta el campo ${campo}: ${r.text}`);
    };
    // login
    await mal("/auth/login", "POST", {});
    await mal("/auth/login", "POST", { email: "mal", password: "x" }, "email");
    await mal("/auth/login", "POST", { email: "a@b.co", password: largo(129) }, "password");
    // registro: nombres, teléfono, longitudes
    for (const [campo, valor] of [["firstName", "Ana2"], ["lastName", "123"], ["phone", "abc1234567"], ["phone", "+++++++"], ["password", "corta"], ["firstName", largo(51)], ["email", `${largo(250)}@x.co`]])
      await mal("/auth/register", "POST", { ...account(P, "inv"), [campo]: valor }, campo);
    // perfil
    await mal("/profile", "PATCH", { firstName: "Lu2", lastName: "Prueba", phone: "+527770000000" }, "firstName");
    await mal("/profile", "PATCH", { firstName: "Ana", lastName: "Prueba", phone: "letras" }, "phone");
    // eventos
    await mal("/events", "POST", eventData({ title: "" }), "title");
    await mal("/events", "POST", eventData({ title: largo(101) }), "title");
    await mal("/events", "POST", eventData({ theme: "inexistente" }), "theme");
    await mal("/events", "POST", eventData({ timeZone: "Marte/Olimpo" }), "timeZone");
    await mal("/events", "POST", eventData({ date: "20/12/2026" }), "date");
    // contraseña olvidada, restablecer y newsletter
    await mal("/auth/password/forgot", "POST", { email: "no-es-correo" }, "email");
    await mal("/auth/password/reset", "POST", { token: "corto", password: "una-clave-larga-1" });
    await mal("/auth/password/reset", "POST", { token: largo(43), password: "corta" });
    await mal("/newsletter/subscribe", "POST", { email: "mal" }, "email");
    // invitaciones y RSVP
    const e = await a.call("/events", "POST", eventData(), 201);
    await mal(`/events/${e.id}/invitations`, "POST", invitationData({ members: [] }));
    await mal(`/events/${e.id}/invitations`, "POST", invitationData({ name: "", email: "", phone: "" }));
    await mal(`/events/${e.id}/invitations`, "POST", invitationData({ kind: "individual", members: [{ name: "Ana", kind: "adult", notes: "" }, { name: "Luis", kind: "adult", notes: "" }] }));
    const inv = await a.call(`/events/${e.id}/invitations`, "POST", invitationData(), 201);
    await mal(`/invitations/${inv.token}/rsvp`, "POST", { members: [{ id: inv.members[0].id, status: "quizas" }] });
    // Los límites exactos sí se aceptan
    await a.call("/profile", "PATCH", { firstName: largo(50), lastName: largo(50), phone: "1".repeat(15) }, 200);
  });

  await suite("Recursos inexistentes o con formato inválido responden 404/400, nunca 500", async () => {
    const a = client();
    await a.call("/auth/register", "POST", account(P, "404"), 201);
    for (const id of ["00000000-0000-4000-8000-000000000000", "no-es-uuid", "1' OR '1'='1"]) {
      for (const [method, path] of [["GET", `/events/${encodeURIComponent(id)}`], ["PATCH", `/events/${encodeURIComponent(id)}`], ["DELETE", `/events/${encodeURIComponent(id)}`], ["GET", `/events/${encodeURIComponent(id)}/invitations`]]) {
        const r = await a.raw(path, { method, body: method === "PATCH" ? eventData() : undefined });
        assert.ok([400, 404].includes(r.status), `${method} ${path} → ${r.status}`);
      }
    }
    for (const token of ["inexistente", "x".repeat(33), "' OR 1=1 --"]) {
      const r = await client().raw(`/invitations/${encodeURIComponent(token)}`);
      assert.ok([400, 404].includes(r.status), `invitación ${token} → ${r.status}`);
    }
    assert.equal((await client().raw("/ruta-que-no-existe")).status, 404);
  });

  mkdirSync("qa-artifacts", { recursive: true });
  writeFileSync("qa-artifacts/endpoints-results.json", JSON.stringify({ date: new Date().toISOString(), tests: records }, null, 2));
  console.log(`${records.length} endpoint checks passed`);
} finally {
  cleanup(P);
}
