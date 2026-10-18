// Endpoints sin cobertura en test-api.mjs, idiomas (es, en, pt, de, fr) y validación de
// entradas. Corre contra la API real: local (Docker) y GitHub Actions.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { translate, supportedLocales, themeIds } from "@tuevento/contracts";
import { base, client, account, cleanup, englishHost, send, spanishHost, suiteRunner, eventData, invitationData, unique } from "./api.mjs";

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

  await suite("El catálogo completo se guarda, se edita y llega a la invitación pública", async () => {
    const organizador = client();
    await organizador.call("/auth/register", "POST", account(P, "temas"), 201);
    const evento = await organizador.call("/events", "POST", eventData(), 201);
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    for (const theme of themeIds) {
      await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ theme }));
      assert.equal((await organizador.call(`/events/${evento.id}`)).theme, theme);
      const publica = await guest.call(`/invitations/${invitacion.token}`);
      assert.equal(publica.event.theme, theme);
    }
    await organizador.call(`/events/${evento.id}`, "DELETE");
  });

  await suite("Postal de evento: se guarda con versiones, usa sus fotos y se lee sin sesión", async () => {
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const organizador = client();
    await organizador.call("/auth/register", "POST", account(P, "postal"), 201);
    const evento = await organizador.call("/events", "POST", eventData(), 201);
    const ruta = `/events/${evento.id}/postcard`;
    assert.equal((await organizador.call(ruta)).design.background.type, "template");
    const foto = await organizador.call(`${ruta}/images`, "POST", { dataUrl: PNG }, 201);
    assert.match(foto.url, /^\/api\/postcards\/images\//);
    const imagen = await send(new URL(foto.url, base), { headers: { "x-tuevento-client": "1" } });
    assert.equal(imagen.status, 200);
    assert.equal(imagen.headers["content-type"], "image/jpeg");
    const diseno = {
      background: { type: "photo", photo: foto.id },
      photos: [],
      texts: [{ content: "Hola", font: "playfair", size: 64, color: "#112233", align: "center", x: 10, y: 20, width: 80 }],
    };
    assert.deepEqual((await organizador.call(ruta, "PUT", diseno)).design.texts, diseno.texts);
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    assert.deepEqual((await guest.call(`/invitations/${invitacion.token}`)).postcard.design, diseno);
    const sinEditar = await organizador.call("/events", "POST", eventData({ theme: "winter" }), 201);
    const invitacionSinEditar = await organizador.call(`/events/${sinEditar.id}/invitations`, "POST", invitationData(), 201);
    assert.deepEqual((await guest.call(`/invitations/${invitacionSinEditar.token}`)).postcard.design, { background: { type: "template", theme: "winter" }, photos: [], texts: [] });
    const [primera] = await organizador.call(`${ruta}/versions`);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [] });
    assert.equal((await organizador.call(`${ruta}/versions`)).length, 2);
    assert.equal((await organizador.call(`${ruta}/versions/${primera.id}/restore`, "POST", {}, 201)).design.texts.length, 1);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...diseno.texts[0], content: "x".repeat(201) }] }, 400);
    await organizador.call(ruta, "PUT", { background: { type: "photo", photo: "00000000-0000-4000-8000-000000000000" }, photos: [], texts: [] }, 400);
    await organizador.call(`${ruta}/images`, "POST", { dataUrl: PNG }, 201);
    await organizador.call(`${ruta}/images`, "POST", { dataUrl: PNG }, 400);
    await organizador.call(`/events/${evento.id}`, "DELETE");
    const borrada = await send(new URL(foto.url, base), { headers: { "x-tuevento-client": "1" } });
    assert.equal(borrada.status, 404);
  });

  await suite("Postal: el texto guarda posición, color libre y sombra; un diseño anterior sin sombra sigue válido", async () => {
    const organizador = client();
    await organizador.call("/auth/register", "POST", account(P, "texto-postal"), 201);
    const evento = await organizador.call("/events", "POST", eventData(), 201);
    const ruta = `/events/${evento.id}/postcard`;
    const sombra = { color: "#000000", blur: 2, x: 0.5, y: -1 };
    const texto = { content: "Mover aquí", font: "manrope", size: 64, color: "#a1b2c3", align: "left", x: 33.5, y: 61, width: 40, shadow: sombra };
    const diseno = { background: { type: "color", color: "#6b6b6b" }, photos: [], texts: [texto] };
    assert.deepEqual((await organizador.call(ruta, "PUT", diseno)).design.texts, [texto]);
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    assert.deepEqual((await guest.call(`/invitations/${invitacion.token}`)).postcard.design.texts, [texto]);
    // Un diseño guardado antes de las sombras (sin el campo) se sigue aceptando y se lee igual
    const anterior = { ...diseno, texts: [{ ...texto, shadow: undefined }] };
    assert.equal((await organizador.call(ruta, "PUT", anterior)).design.texts[0].shadow, undefined);
    // Límites: sombra fuera de rango o color que no es hexadecimal se rechazan
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, shadow: { ...sombra, blur: 11 } }] }, 400);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, shadow: { ...sombra, x: -6 } }] }, 400);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, shadow: { ...sombra, color: "rojo" } }] }, 400);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, color: "azul" }] }, 400);
    await organizador.call(`/events/${evento.id}`, "DELETE");
  });

  await suite("Dirección pública del evento: se elige, es única, se lee sin sesión y no muestra invitados", async () => {
    const organizador = client();
    const otro = client();
    await organizador.call("/auth/register", "POST", account(P, "url-a"), 201);
    await otro.call("/auth/register", "POST", account(P, "url-b"), 201);
    const slug = `evento-${unique}`;
    const evento = await organizador.call("/events", "POST", eventData(), 201);
    assert.equal(evento.slug, "");
    const publicado = await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug }));
    assert.equal(publicado.slug, slug);
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData({ email: `url-${unique}@example.invalid` }), 201);
    const publico = await guest.call(`/public/events/${slug}`);
    assert.deepEqual(Object.keys(publico).sort(), ["cancelled", "date", "description", "host", "location", "locked", "postcard", "theme", "timeZone", "title"]);
    assert.deepEqual(Object.keys(publico.host).sort(), ["avatar", "firstName", "lastName"]);
    assert.equal(JSON.stringify(publico).includes(invitacion.token), false);
    assert.equal(JSON.stringify(publico).includes(`url-${unique}@example.invalid`), false);
    // Dos eventos no comparten dirección, ni al crear ni al editar
    const ajeno = await otro.call("/events", "POST", eventData({ slug }), 409);
    assert.equal(ajeno.message, translate("es", "errors.eventSlugTaken"));
    const otroEvento = await otro.call("/events", "POST", eventData(), 201);
    await otro.call(`/events/${otroEvento.id}`, "PATCH", eventData({ slug }), 409);
    // Formato: minúsculas, números y guiones entre palabras, de 3 a 60
    for (const malo of ["Boda Ana", "ab", "-evento", "evento-", "evento--x", "a".repeat(61)]) {
      await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug: malo }), 400);
    }
    // Quitarla deja el evento sin dirección pública; archivarlo también la cierra
    assert.equal((await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug: "" }))).slug, "");
    await guest.call(`/public/events/${slug}`, "GET", undefined, 404);
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug }));
    assert.equal((await guest.call(`/public/events/${slug}`)).title, eventData().title);
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, archived: true }));
    await guest.call(`/public/events/${slug}`, "GET", undefined, 404);
    await guest.call(`/public/events/no-existe-${unique}`, "GET", undefined, 404);
  });

  await suite("Calendario, contraseña de la página pública e invitación genérica", async () => {
    const organizador = client();
    const visitante = client();
    await organizador.call("/auth/register", "POST", account(P, "avisos"), 201);
    const slug = `avisos-${unique}`;
    const evento = await organizador.call("/events", "POST", eventData({ slug }), 201);
    const personal = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    // Disponibilidad de la dirección: libre, ocupada, la propia y con formato inválido
    assert.equal((await organizador.call(`/events/slug-available?slug=libre-${unique}`)).available, true);
    assert.equal((await organizador.call(`/events/slug-available?slug=${slug}`)).available, false);
    assert.equal((await organizador.call(`/events/slug-available?slug=${slug}&eventId=${evento.id}`)).available, true);
    assert.equal((await organizador.call("/events/slug-available?slug=No%20valido")).available, false);
    // Calendario: .ics de la invitación, con el estado al día
    const ics = await visitante.raw(`/invitations/${personal.token}/calendar.ics`);
    assert.equal(ics.status, 200);
    assert.match(ics.headers["content-type"], /^text\/calendar/);
    assert.match(ics.text, /BEGIN:VCALENDAR/);
    assert.match(ics.text, /STATUS:CONFIRMED/);
    assert.equal((await visitante.raw(`/invitations/${"x".repeat(32)}/calendar.ics`)).status, 404);
    // Cancelar: el .ics lo marca, la invitación lo muestra y ya no se puede responder
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, cancelled: true }));
    assert.match((await visitante.raw(`/invitations/${personal.token}/calendar.ics`)).text, /STATUS:CANCELLED/);
    assert.equal((await visitante.call(`/invitations/${personal.token}`)).event.cancelled, true);
    await visitante.call(`/invitations/${personal.token}/rsvp`, "POST", { members: [{ id: personal.members[0].id, status: "accepted" }] }, 400);
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, cancelled: false }));
    // Contraseña de la página pública: bloquea, se desbloquea con la clave y se conserva al editar
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, publicPassword: "clave-de-prueba" }));
    assert.equal((await organizador.call(`/events/${evento.id}`)).hasPublicPassword, true);
    assert.deepEqual(await visitante.call(`/public/events/${slug}`), { locked: true });
    assert.equal((await visitante.raw(`/public/events/${slug}/calendar.ics`)).status, 404);
    await visitante.call(`/public/events/${slug}/unlock`, "POST", { password: "mal" }, 401);
    const acceso = await visitante.raw(`/public/events/${slug}/unlock`, { method: "POST", body: { password: "clave-de-prueba" } });
    assert.equal(acceso.status, 200);
    assert.ok(acceso.setCookie.some((c) => c.startsWith("event_access=") && /HttpOnly/.test(c)));
    assert.equal((await visitante.call(`/public/events/${slug}`)).locked, false);
    assert.equal((await visitante.raw(`/public/events/${slug}/calendar.ics`)).status, 200);
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug }));
    assert.equal((await organizador.call(`/events/${evento.id}`)).hasPublicPassword, true);
    // Tras diez fallos, la contraseña se bloquea un rato aunque sea la correcta
    const intentos = client();
    for (let i = 0; i < 10; i++) await intentos.call(`/public/events/${slug}/unlock`, "POST", { password: "mal" }, 401);
    await intentos.call(`/public/events/${slug}/unlock`, "POST", { password: "clave-de-prueba" }, 429);
    // Quitar la contraseña deja la página abierta
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, publicPassword: "" }));
    assert.equal((await organizador.call(`/events/${evento.id}`)).hasPublicPassword, false);
    assert.equal((await visitante.call(`/public/events/${slug}`)).locked, false);
    // Invitación genérica: sin personas, y cada invitado se registra con sus propios datos
    const abierta = await organizador.call(`/events/${evento.id}/invitations`, "POST", { name: "Para todos", kind: "open", email: "", phone: "", notes: "", members: [] }, 201);
    assert.equal(abierta.kind, "open");
    assert.equal(abierta.parentId, null);
    const vista = await visitante.call(`/invitations/${abierta.token}`);
    assert.equal(vista.kind, "open");
    assert.deepEqual(vista.members, []);
    assert.equal(vista.registrationsFull, false);
    await organizador.call(`/events/${evento.id}/invitations`, "POST", { name: "Para todos", kind: "open", email: "", phone: "", notes: "", members: [{ name: "Alguien", kind: "adult", notes: "" }] }, 400);
    const registro = await visitante.call(`/invitations/${abierta.token}/register`, "POST", {
      name: "Familia Ruiz",
      email: `ruiz-${unique}@example.invalid`,
      phone: "",
      notes: "",
      kind: "family",
      members: [
        { name: "Paula Ruiz", kind: "adult", notes: "", status: "accepted" },
        { name: "Hugo Ruiz", kind: "child", notes: "", status: "pending" },
      ],
    }, 201);
    const propia = await visitante.call(`/invitations/${registro.token}`);
    assert.equal(propia.kind, "family");
    assert.deepEqual(propia.members.map((m) => m.status), ["accepted", "pending"]);
    const lista = await organizador.call(`/events/${evento.id}/invitations`);
    assert.equal(lista.find((i) => i.token === registro.token).parentId, abierta.id);
    // Un registro sin personas, o con tipo "open", no se acepta
    await visitante.call(`/invitations/${abierta.token}/register`, "POST", { name: "Sin personas", kind: "individual", email: "", phone: "", notes: "", members: [] }, 400);
    await visitante.call(`/invitations/${abierta.token}/register`, "POST", { name: "Tipo abierto", kind: "open", email: "", phone: "", notes: "", members: [{ name: "A", kind: "adult", notes: "", status: "pending" }] }, 400);
    // Solo las genéricas aceptan registros: una personal responde 404
    await visitante.call(`/invitations/${personal.token}/register`, "POST", { name: "Intruso", kind: "individual", email: "", phone: "", notes: "", members: [{ name: "Intruso", kind: "adult", notes: "", status: "pending" }] }, 404);
    // Cancelado: no admite registros
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, cancelled: true }));
    await visitante.call(`/invitations/${abierta.token}/register`, "POST", { name: "Tarde", kind: "individual", email: "", phone: "", notes: "", members: [{ name: "Tarde", kind: "adult", notes: "", status: "pending" }] }, 400);
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, cancelled: false }));
    // Borrar el enlace genérico no borra sus registros: quedan como invitaciones normales
    await organizador.call(`/events/${evento.id}/invitations/${abierta.id}`, "DELETE");
    assert.ok((await organizador.call(`/events/${evento.id}/invitations`)).some((i) => i.token === registro.token && i.parentId === null));
  });

  await suite("Acceso demo: solo para cuentas registradas, sin privilegios", async () => {
    const { demoEnabled } = await guest.call("/config");
    // Sin sesión nunca se crea una demostración
    await guest.call("/auth/demo", "POST", {}, 401);
    const cuenta = client();
    await cuenta.call("/auth/register", "POST", account("demo-reg", "a"), 201);
    if (!demoEnabled) return void (await cuenta.call("/auth/demo", "POST", {}, 404));
    const user = await cuenta.call("/auth/demo", "POST", {}, 201);
    assert.equal(user.isDemo, true);
    assert.equal(user.isOwner, false);
    assert.ok(cuenta.cookie().startsWith("session="));
    await cuenta.call("/owner/metrics", "GET", undefined, 403);
    // Una demostración no abre otra
    await cuenta.call("/auth/demo", "POST", {}, 403);
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
    await mal("/auth/login", "POST", { email: "a@b.co", password: "corta" }, "password");
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
