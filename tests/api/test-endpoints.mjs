// Endpoints sin cobertura en test-api.mjs, idiomas (es, en, pt, de, fr) y validación de
// entradas. Corre contra la API real: local (Docker) y GitHub Actions.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { translate, supportedLocales, themeIds } from "@tuevento/contracts";
import { base, client, account, cleanup, englishHost, send, spanishHost, suiteRunner, eventData, invitationData, unique, pngDataUrl, providerData } from "./api.mjs";

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
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...diseno.texts[0], content: "x".repeat(201) }] }, 422);
    await organizador.call(ruta, "PUT", { background: { type: "photo", photo: "00000000-0000-4000-8000-000000000000" }, photos: [], texts: [] }, 400);
    await organizador.call(`${ruta}/images`, "POST", { dataUrl: PNG }, 201);
    await organizador.call(`${ruta}/images`, "POST", { dataUrl: PNG }, 409);
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
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, shadow: { ...sombra, blur: 11 } }] }, 422);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, shadow: { ...sombra, x: -6 } }] }, 422);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, shadow: { ...sombra, color: "rojo" } }] }, 422);
    await organizador.call(ruta, "PUT", { ...diseno, texts: [{ ...texto, color: "azul" }] }, 422);
    await organizador.call(`/events/${evento.id}`, "DELETE");
  });

  await suite("Landing del evento: dirección automática y única por cuenta, el organizador la ve y el invitado entra con su enlace", async () => {
    const organizador = client();
    const otro = client();
    const visitante = client();
    await organizador.call("/auth/register", "POST", account(P, "url-a"), 201);
    await otro.call("/auth/register", "POST", account(P, "url-b"), 201);
    const { publicCode: codigo } = await organizador.call("/auth/me");
    assert.match(codigo, /^[a-z0-9]{8}$/);
    assert.notEqual((await otro.call("/auth/me")).publicCode, codigo);
    // Todo evento tiene dirección: sin escribirla, sale del título; repetida en la cuenta, con -2
    const titulo = `Fiesta ${unique}`;
    const evento = await organizador.call("/events", "POST", eventData({ title: titulo }), 201);
    assert.equal(evento.slug, `fiesta-${unique}`);
    assert.equal((await organizador.call("/events", "POST", eventData({ title: titulo }), 201)).slug, `fiesta-${unique}-2`);
    // Al editar sin dirección, se conserva la que tenía
    assert.equal((await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ title: titulo, slug: "" }))).slug, evento.slug);
    const slug = `evento-${unique}`;
    assert.equal((await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug }))).slug, slug);
    const landing = `/public/landing/${codigo}/${slug}`;
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData({ email: `url-${unique}@example.invalid` }), 201);
    // El organizador ve su landing con el acceso a su panel, sin invitados
    const propia = await organizador.call(landing);
    assert.equal(propia.access, "owner");
    assert.equal(propia.eventId, evento.id);
    assert.deepEqual(Object.keys(propia.event).sort(), ["cancelled", "date", "description", "geo", "host", "location", "postcard", "theme", "timeZone", "title"]);
    assert.deepEqual(Object.keys(propia.event.host).sort(), ["avatar", "firstName", "lastName"]);
    assert.equal(JSON.stringify(propia).includes(invitacion.token), false);
    assert.equal(JSON.stringify(propia).includes(`url-${unique}@example.invalid`), false);
    // Sin sesión ni enlace personal, la landing no existe para quien pregunta
    await visitante.call(landing, "GET", undefined, 404);
    await otro.call(landing, "GET", undefined, 404);
    // El enlace personal da acceso: una cookie solo para la landing, y la landing muestra su invitación
    const acceso = await visitante.raw(`/invitations/${invitacion.token}/access`, { method: "POST", body: {} });
    assert.equal(acceso.status, 200);
    assert.deepEqual(acceso.data, { code: codigo, slug });
    const cookie = acceso.setCookie.find((c) => c.startsWith(`landing_${evento.id}=`));
    assert.ok(cookie && /HttpOnly/i.test(cookie) && /Path=\/api\/public\/landing/i.test(cookie) && /SameSite=Lax/i.test(cookie), cookie);
    assert.deepEqual(await visitante.call(landing), { access: "guest", token: invitacion.token });
    assert.equal((await visitante.raw(`${landing}/calendar.ics`)).status, 200);
    assert.equal((await client().raw(`${landing}/calendar.ics`)).status, 404);
    // El organizador que abre el enlace personal de un invitado ve esa invitación, con su panel a mano
    await organizador.call(`/invitations/${invitacion.token}/access`, "POST", {});
    assert.deepEqual(await organizador.call(landing), { access: "guest", token: invitacion.token, eventId: evento.id });
    // El calendario de la invitación enlaza a la landing, en el idioma de quien lo pide
    assert.match((await visitante.raw(`/invitations/${invitacion.token}/calendar.ics`)).text, new RegExp(`/${codigo}/${slug}`));
    // Las respuestas siguen yendo por la invitación
    const respuesta = await visitante.call(`/invitations/${invitacion.token}/rsvp`, "POST", { members: invitacion.members.map((m) => ({ id: m.id, status: "accepted" })) }, 201);
    assert.ok(respuesta.members.every((m) => m.status === "accepted"));
    await visitante.call(`/invitations/${"x".repeat(32)}/access`, "POST", {}, 404);
    // Borrar la invitación quita su acceso
    await organizador.call(`/events/${evento.id}/invitations/${invitacion.id}`, "DELETE");
    await visitante.call(landing, "GET", undefined, 404);
    // La dirección es única dentro de la cuenta; otra cuenta puede usar la misma
    const repetida = await organizador.call("/events", "POST", eventData({ slug }), 409);
    assert.equal(repetida.message, translate("es", "errors.eventSlugTaken"));
    const ajeno = await otro.call("/events", "POST", eventData({ slug }), 201);
    assert.equal(ajeno.slug, slug);
    assert.equal((await organizador.call(`/events/slug-available?slug=${slug}`)).available, false);
    assert.equal((await otro.call(`/events/slug-available?slug=fiesta-${unique}`)).available, true);
    // Formato: minúsculas, números y guiones entre palabras, de 3 a 60
    for (const malo of ["Boda Ana", "ab", "-evento", "evento-", "evento--x", "a".repeat(61)]) {
      await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug: malo }), 422);
    }
    // Las direcciones /e/… de antes llevan a la landing si solo un evento la usa
    const unica = `unica-${unique}`;
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug: unica }));
    assert.deepEqual(await client().call(`/public/events/${unica}`), { code: codigo, slug: unica });
    // Con dos cuentas en la misma dirección, /e/… no sabe a cuál llevar
    await organizador.call("/events", "POST", eventData({ slug }), 201);
    await client().call(`/public/events/${slug}`, "GET", undefined, 404);
    await client().call(`/public/events/no-existe-${unique}`, "GET", undefined, 404);
    // Archivado: el organizador lo sigue viendo; los invitados ya no
    const segunda = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    const invitado = client();
    await invitado.call(`/invitations/${segunda.token}/access`, "POST", {});
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug: unica, archived: true }));
    await invitado.call(`/public/landing/${codigo}/${unica}`, "GET", undefined, 404);
    assert.equal((await organizador.call(`/public/landing/${codigo}/${unica}`)).access, "owner");
    await invitado.call(`/invitations/${segunda.token}/access`, "POST", {}, 404);
    await client().call(`/public/landing/${codigo}/no-existe-${unique}`, "GET", undefined, 404);
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
    // Contraseña del evento: otra forma de entrar a la landing; se conserva al editar
    const { publicCode: codigo } = await organizador.call("/auth/me");
    const landing = `/public/landing/${codigo}/${slug}`;
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, publicPassword: "clave-de-prueba" }));
    assert.equal((await organizador.call(`/events/${evento.id}`)).hasPublicPassword, true);
    assert.deepEqual(await visitante.call(landing), { access: "locked" });
    assert.equal((await visitante.raw(`${landing}/calendar.ics`)).status, 404);
    await visitante.call(`${landing}/unlock`, "POST", { password: "mal" }, 401);
    const acceso = await visitante.raw(`${landing}/unlock`, { method: "POST", body: { password: "clave-de-prueba" } });
    assert.equal(acceso.status, 200);
    assert.ok(acceso.setCookie.some((c) => c.startsWith(`landing_${evento.id}=`) && /HttpOnly/.test(c)));
    assert.equal((await visitante.call(landing)).access, "password");
    assert.equal((await visitante.raw(`${landing}/calendar.ics`)).status, 200);
    // Con contraseña, quien entra con su enlace personal sigue viendo su invitación
    const conEnlace = client();
    await conEnlace.call(`/invitations/${personal.token}/access`, "POST", {});
    assert.deepEqual(await conEnlace.call(landing), { access: "guest", token: personal.token });
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug }));
    assert.equal((await organizador.call(`/events/${evento.id}`)).hasPublicPassword, true);
    // Tras diez fallos, la contraseña se bloquea un rato aunque sea la correcta
    const intentos = client();
    for (let i = 0; i < 10; i++) await intentos.call(`${landing}/unlock`, "POST", { password: "mal" }, 401);
    await intentos.call(`${landing}/unlock`, "POST", { password: "clave-de-prueba" }, 429);
    // Sin contraseña, la landing vuelve a ser solo para invitados y organizador
    await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ slug, publicPassword: "" }));
    assert.equal((await organizador.call(`/events/${evento.id}`)).hasPublicPassword, false);
    await visitante.call(landing, "GET", undefined, 404);
    // Invitación genérica: sin personas, y cada invitado se registra con sus propios datos
    const abierta = await organizador.call(`/events/${evento.id}/invitations`, "POST", { name: "Para todos", kind: "open", email: "", phone: "", notes: "", members: [] }, 201);
    assert.equal(abierta.kind, "open");
    assert.equal(abierta.parentId, null);
    const vista = await visitante.call(`/invitations/${abierta.token}`);
    assert.equal(vista.kind, "open");
    assert.deepEqual(vista.members, []);
    assert.equal(vista.registrationsFull, false);
    await organizador.call(`/events/${evento.id}/invitations`, "POST", { name: "Para todos", kind: "open", email: "", phone: "", notes: "", members: [{ name: "Alguien", kind: "adult", notes: "" }] }, 422);
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
    await visitante.call(`/invitations/${abierta.token}/register`, "POST", { name: "Sin personas", kind: "individual", email: "", phone: "", notes: "", members: [] }, 422);
    await visitante.call(`/invitations/${abierta.token}/register`, "POST", { name: "Tipo abierto", kind: "open", email: "", phone: "", notes: "", members: [{ name: "A", kind: "adult", notes: "", status: "pending" }] }, 422);
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
    assert.equal((await guest.raw("/auth/google", { method: "POST", body: { credential: "x" } })).status, 422);
    assert.equal((await guest.raw("/auth/google", { method: "POST", body: { credential: "x".repeat(12001), nonce: r.data.nonce } })).status, 422);
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
      assert.equal(r.status, 422);
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

  await suite("Validación de entradas: lo inválido responde 422 en Problem Details con el campo", async () => {
    const a = client();
    await a.call("/auth/register", "POST", account(P, "val"), 201);
    const largo = (n, c = "a") => c.repeat(n);
    const mal = async (path, method, body, campo) => {
      const r = await a.raw(path, { method, body });
      assert.equal(r.status, 422, `${method} ${path} ${JSON.stringify(body).slice(0, 80)} → ${r.status} ${r.text.slice(0, 120)}`);
      assert.match(r.headers["content-type"], /^application\/problem\+json/);
      assert.equal(r.data.status, 422);
      assert.equal(r.data.code, "validation_failed");
      assert.ok(r.data.requestId && r.data.requestId === r.headers["x-request-id"], `requestId: ${r.text}`);
      if (campo) {
        assert.ok(r.data.errors?.some((e) => e.field === campo && e.code && e.message), `falta el campo ${campo}: ${r.text}`);
        // Las versiones publicadas de la app leen `fields` hasta la siguiente versión mayor
        assert.ok(r.data.fields?.[campo], `falta fields.${campo}: ${r.text}`);
      }
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
    await a.call("/profile", "PATCH", { firstName: largo(50), lastName: largo(50), phone: "+52 (777) 123-45-67" }, 200);
  });

  await suite("Tipo de cuenta: se elige al registrarse, sin elegirlo se organiza y no se cambia después", async () => {
    const organizador = client();
    assert.equal((await organizador.call("/auth/register", "POST", account(P, "tipo-org"), 201)).accountType, "organizer");
    const proveedor = client();
    const creado = await proveedor.call("/auth/register", "POST", account(P, "tipo-prov", { accountType: "provider" }), 201);
    assert.equal(creado.accountType, "provider");
    assert.equal((await proveedor.call("/auth/me")).accountType, "provider");
    const explicito = client();
    assert.equal((await explicito.call("/auth/register", "POST", account(P, "tipo-org2", { accountType: "organizer" }), 201)).accountType, "organizer");
    // Un tipo que no existe: 422 con el campo, traducido
    for (const [locale, headers] of [["es", { Host: spanishHost }], ["en", { Host: englishHost }], ["pt", { Host: englishHost, "X-App-Locale": "pt" }], ["de", { Host: englishHost, "X-App-Locale": "de" }], ["fr", { Host: englishHost, "X-App-Locale": "fr" }]]) {
      const r = await client().raw("/auth/register", { method: "POST", body: account(P, `tipo-mal-${locale}`, { accountType: "admin" }), headers });
      assert.equal(r.status, 422);
      const error = r.data.errors.find((e) => e.field === "accountType");
      assert.equal(error?.message, translate(locale, "validation.invalidAccountType"), r.text);
    }
    // Google acepta el tipo (solo cuenta al crear la cuenta) y rechaza uno inválido antes de verificar
    const { nonce } = await client().call("/auth/google/nonce", "POST", {}, 201);
    assert.equal((await client().raw("/auth/google", { method: "POST", body: { credential: "x", nonce, accountType: "admin" } })).status, 422);
    // Ni el organizador ni el proveedor cambian su tipo desde el perfil
    const perfil = { firstName: "Ana", lastName: "Pérez", phone: "" };
    assert.equal((await proveedor.raw("/profile", { method: "PATCH", body: { ...perfil, accountType: "organizer" } })).status, 422);
    assert.equal((await proveedor.call("/profile", "PATCH", perfil)).accountType, "provider");
  });

  const locales = [["es", { Host: spanishHost }], ["en", { Host: englishHost }], ["pt", { Host: englishHost, "X-App-Locale": "pt" }], ["de", { Host: englishHost, "X-App-Locale": "de" }], ["fr", { Host: englishHost, "X-App-Locale": "fr" }]];
  const proveedorNuevo = async (n) => {
    const c = client();
    await c.call("/auth/register", "POST", account(P, n, { accountType: "provider" }), 201);
    return c;
  };

  await suite("Proveedor: el perfil se crea, se valida campo a campo en 5 idiomas y se edita", async () => {
    const p = await proveedorNuevo("prov-perfil");
    assert.deepEqual(await p.call("/provider/profile"), { profile: null });
    // Servicios y fotos esperan a que exista el negocio
    assert.equal((await p.raw("/provider/services", { method: "POST", body: { title: "Mesa de postres" } })).status, 404);
    const perfil = await p.call("/provider/profile", "PUT", providerData({ description: "  Banquetes para bodas  " }));
    assert.equal(perfil.slug, `banquetes-qa-${unique}`);
    assert.equal(perfil.whatsapp, "+527771234567");
    assert.equal(perfil.description, "Banquetes para bodas");
    assert.equal(perfil.status, "draft");
    assert.deepEqual(perfil.missing, ["photo"]);
    assert.deepEqual((await p.call("/provider/profile")).profile.categories, ["catering"]);
    // Cada campo inválido responde 422 con su campo y el mensaje en el idioma de la petición
    const malos = [
      [{ businessName: "x".repeat(151) }, "businessName", "validation.maximum150Characters"],
      [{ description: "x".repeat(5001) }, "description", "validation.maximum5000Characters"],
      [{ categories: ["catering", "dj", "bar", "bakery", "venue", "other"] }, "categories", "validation.maximum5Categories"],
      [{ categories: ["pirotecnia"] }, "categories.0", "validation.invalidCategory"],
      [{ website: "http://banquetes.example" }, "website", "validation.useHttpsLink"],
      [{ instagramUrl: "https://evil.example/banquetes" }, "instagramUrl", "validation.useProfileLink"],
      [{ whatsapp: "777 123 abcd" }, "whatsapp", "validation.useNumbersSpaces"],
      [{ postalCode: "62<00>" }, "postalCode", "validation.postalCodeFormat"],
      [{ serviceRadiusKm: 900 }, "serviceRadiusKm", "validation.serviceRadius"],
      [{ slug: "buscar" }, "slug", "validation.reservedAddress"],
      [{ geo: { lat: 99, lng: 0 } }, "geo.lat", "validation.invalidCoordinates"],
    ];
    for (const [cambio, campo, mensaje] of malos)
      for (const [locale, headers] of locales) {
        const r = await p.raw("/provider/profile", { method: "PUT", body: providerData(cambio), headers });
        assert.equal(r.status, 422, `${campo}: ${r.text}`);
        // El mensaje esperado está entre los del campo (un dato puede incumplir varias reglas)
        const mensajes = r.data.errors.filter((e) => e.field === campo).map((e) => e.message);
        assert.ok(mensajes.includes(translate(locale, mensaje)), `${locale} ${campo}: ${r.text}`);
      }
    assert.equal((await p.raw("/provider/profile", { method: "PUT", body: { ...providerData(), status: "published" } })).status, 422);
  });

  await suite("Proveedor: la dirección es única, se comprueba antes y la anterior de una página publicada queda reservada", async () => {
    const a = await proveedorNuevo("prov-slug-a");
    const b = await proveedorNuevo("prov-slug-b");
    const slug = `fiestas-${unique}`;
    await a.call("/provider/profile", "PUT", providerData({ slug }));
    assert.deepEqual(await b.call(`/provider/slug-available?slug=${slug}`), { available: false });
    assert.deepEqual(await a.call(`/provider/slug-available?slug=${slug}`), { available: true });
    assert.deepEqual(await b.call("/provider/slug-available?slug=buscar"), { available: false });
    const ocupada = await b.raw("/provider/profile", { method: "PUT", body: providerData({ slug }) });
    assert.equal(ocupada.status, 409);
    // Sin escribirla, el mismo nombre recibe -2
    assert.equal((await b.call("/provider/profile", "PUT", providerData({ businessName: `Fiestas ${unique}` }))).slug, `${slug}-2`);
    // Publicada y renombrada: la dirección anterior no la puede usar nadie
    await a.call("/provider/images", "POST", { dataUrl: pngDataUrl(), alt: "Mesa de banquete" }, 201);
    await a.call("/provider/publish", "POST", {});
    const nueva = `${slug}-nueva`;
    assert.equal((await a.call("/provider/profile", "PUT", providerData({ slug: nueva }))).slug, nueva);
    assert.deepEqual(await b.call(`/provider/slug-available?slug=${slug}`), { available: false });
    assert.equal((await b.raw("/provider/profile", { method: "PUT", body: providerData({ slug }) })).status, 409);
    // Volver a la anterior sí se puede
    assert.equal((await a.call("/provider/profile", "PUT", providerData({ slug }))).slug, slug);
  });

  await suite("Proveedor: publicar exige lo mínimo y una página que deja de cumplirlo vuelve a borrador", async () => {
    const p = await proveedorNuevo("prov-publicar");
    await p.call("/provider/profile", "PUT", { businessName: `Luz ${unique}` });
    const r = await p.raw("/provider/publish", { method: "POST", body: {} });
    assert.equal(r.status, 422);
    assert.equal(r.data.code, "provider_not_complete");
    assert.deepEqual(r.data.errors.map((e) => e.field).sort(), ["category", "contact", "location", "photo"]);
    assert.equal(r.data.errors.find((e) => e.field === "photo").message, translate("es", "providers.missing.photo"));
    await p.call("/provider/profile", "PUT", providerData({ businessName: `Luz ${unique}` }));
    const sinTexto = await p.call("/provider/images", "POST", { dataUrl: pngDataUrl() }, 201);
    assert.deepEqual(sinTexto.missing, ["photoAlt"]);
    const [foto] = sinTexto.images;
    await p.call(`/provider/images/${foto.id}`, "PATCH", { alt: "Escenario iluminado", serviceId: null });
    const publicado = await p.call("/provider/publish", "POST", {});
    assert.equal(publicado.status, "published");
    assert.ok(publicado.publishedAt);
    // Sin la única foto, la página vuelve a borrador sola
    assert.equal((await p.call(`/provider/images/${foto.id}`, "DELETE")).status, "draft");
    assert.equal((await p.call("/provider/unpublish", "POST", {})).status, "draft");
  });

  await suite("Proveedor: servicios con precio en centavos, orden y borrado", async () => {
    const p = await proveedorNuevo("prov-servicios");
    await p.call("/provider/profile", "PUT", providerData());
    const precio = { fromCents: 1250000, currency: "MXN", unit: "event" };
    const a = await p.call("/provider/services", "POST", { title: "Banquete de 3 tiempos", price: precio }, 201);
    assert.deepEqual(a.price, precio);
    const b = await p.call("/provider/services", "POST", { title: "Mesa de postres", description: "Pasteles y galletas" }, 201);
    assert.equal(b.price, null);
    assert.equal((await p.call(`/provider/services/${b.id}`, "PUT", { title: "Mesa de dulces", price: { ...precio, unit: "person" } })).price.unit, "person");
    assert.deepEqual((await p.call("/provider/services/order", "PUT", { ids: [b.id, a.id] })).services.map((s) => s.id), [b.id, a.id]);
    // El orden tiene que incluir todos: uno de menos es 409
    assert.equal((await p.raw("/provider/services/order", { method: "PUT", body: { ids: [a.id] } })).status, 409);
    for (const [cambio, campo] of [
      [{ price: { ...precio, fromCents: -1 } }, "price.fromCents"],
      [{ price: { ...precio, fromCents: 10.5 } }, "price.fromCents"],
      [{ price: { ...precio, currency: "XXX" } }, "price.currency"],
      [{ price: { fromCents: 100 } }, "price.currency"],
      [{ title: "x".repeat(151) }, "title"],
      [{ description: "x".repeat(2001) }, "description"],
    ]) {
      const r = await p.raw("/provider/services", { method: "POST", body: { title: "Servicio", ...cambio } });
      assert.equal(r.status, 422, JSON.stringify(cambio));
      assert.ok(r.data.errors.some((e) => e.field === campo), `${campo}: ${r.text}`);
    }
    assert.equal((await p.raw(`/provider/services/${a.id}`, { method: "DELETE" })).status, 204);
    assert.equal((await p.raw(`/provider/services/${a.id}`, { method: "PUT", body: { title: "Otra vez" } })).status, 404);
    assert.equal((await p.raw("/provider/services/no-es-uuid", { method: "PUT", body: { title: "Otra" } })).status, 400);
  });

  await suite("Proveedor: fotos en dos tamaños, portada, logo, servicio, orden y cuotas", async () => {
    const p = await proveedorNuevo("prov-fotos");
    await p.call("/provider/profile", "PUT", providerData());
    const servicio = await p.call("/provider/services", "POST", { title: "Pasteles" }, 201);
    let perfil = await p.call("/provider/images", "POST", { dataUrl: pngDataUrl(40, 30), alt: "Pastel de tres pisos", serviceId: servicio.id }, 201);
    const [foto] = perfil.images;
    assert.deepEqual([foto.width, foto.height, foto.serviceId], [40, 30, servicio.id]);
    assert.deepEqual(Object.keys(foto.urls).sort(), ["1600", "480"]);
    // Sin publicar, la foto solo la ve su dueño
    assert.equal((await p.raw(foto.urls[480].replace(/^\/api/, ""))).status, 200);
    assert.equal((await client().raw(foto.urls[480].replace(/^\/api/, ""))).status, 404);
    assert.equal((await p.raw(foto.urls[480].replace(/^\/api/, "").replace(/480$/, "999"))).status, 404);
    perfil = await p.call("/provider/cover", "PUT", { imageId: foto.id });
    assert.equal(perfil.coverImageId, foto.id);
    assert.equal((await p.call("/provider/logo", "PUT", { imageId: foto.id })).logoImageId, foto.id);
    await p.call("/provider/publish", "POST", {});
    const publica = await client().raw(foto.urls[1600].replace(/^\/api/, ""));
    assert.equal(publica.status, 200);
    assert.equal(publica.headers["content-type"], "image/jpeg");
    assert.match(publica.headers["cache-control"], /immutable/);
    // Archivos que no son imagen o con otro tipo: 422
    for (const dataUrl of ["data:image/png;base64,bm8gZXMgdW5hIGltYWdlbg==", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "data:text/html;base64,PHNjcmlwdD4="])
      assert.equal((await p.raw("/provider/images", { method: "POST", body: { dataUrl } })).status, 422, dataUrl.slice(0, 25));
    // Hasta 10 fotos por servicio y 40 por perfil: la 41 se rechaza
    for (let n = 2; n <= 10; n++) await p.call("/provider/images", "POST", { dataUrl: pngDataUrl(), alt: `Pastel ${n}`, serviceId: servicio.id }, 201);
    const once = await p.raw("/provider/images", { method: "POST", body: { dataUrl: pngDataUrl(), serviceId: servicio.id } });
    assert.equal(once.status, 422);
    for (let n = 11; n <= 40; n++) await p.call("/provider/images", "POST", { dataUrl: pngDataUrl(), alt: `Foto ${n}` }, 201);
    const cuarentaYUna = await p.raw("/provider/images", { method: "POST", body: { dataUrl: pngDataUrl(), alt: "Una más" } });
    assert.equal(cuarentaYUna.status, 422);
    assert.equal(cuarentaYUna.data.detail, translate("es", "errors.providerImageLimit"));
    // Orden y borrado: la portada que se borra deja de serlo
    const ids = (await p.call("/provider/profile")).profile.images.map((i) => i.id);
    assert.deepEqual((await p.call("/provider/images/order", "PUT", { ids: [...ids].reverse() })).images.map((i) => i.id), [...ids].reverse());
    perfil = await p.call(`/provider/images/${foto.id}`, "DELETE");
    assert.equal(perfil.coverImageId, null);
    assert.equal(perfil.images.length, 39);
    assert.equal((await client().raw(foto.urls[480].replace(/^\/api/, ""))).status, 404);
  });

  await suite("Proveedor: página pública, estado para los buscadores en 5 idiomas y sitemap", async () => {
    const p = await proveedorNuevo("prov-pagina");
    const slug = `pagina-${unique}`;
    const datos = providerData({ businessName: `Salón Ñandú "${unique}" <b>`, headline: "Bodas & XV años", slug, address: "Calle Luna 5", postalCode: "62000" });
    await p.call("/provider/profile", "PUT", datos);
    const { images: [foto] } = await p.call("/provider/images", "POST", { dataUrl: pngDataUrl(), alt: "Salón decorado" }, 201);
    // Borrador: ni página ni estado para los buscadores
    assert.equal((await client().raw(`/public/providers/${slug}`)).status, 404);
    assert.equal((await client().raw(`/internal/seo/providers/${slug}`)).status, 403);
    await p.call("/provider/publish", "POST", {});
    // Publicada, con la dirección aproximada: sin calle ni código postal y el punto a 2 decimales
    const pagina = await client().call(`/public/providers/${slug}`);
    for (const privado of ["id", "userId", "email", "status", "missing", "coverImageId"]) assert.ok(!(privado in pagina), privado);
    assert.equal(pagina.businessName, datos.businessName);
    assert.equal(pagina.address, "");
    assert.equal(pagina.postalCode, "");
    assert.deepEqual(pagina.geo, { lat: 18.92, lng: -99.23 });
    assert.equal(pagina.cover.id, foto.id);
    // Exacta: la dirección y el punto tal cual
    await p.call("/provider/profile", "PUT", { ...datos, addressVisibility: "exact" });
    const exacta = await client().call(`/public/providers/${slug}`);
    assert.equal(exacta.address, "Calle Luna 5");
    assert.deepEqual(exacta.geo, datos.geo);
    // Para nginx: título y descripción escapados para HTML y en ASCII, en el idioma de la página
    for (const [lang, headers] of locales) {
      const r = await client().raw(`/internal/seo/providers/${slug}`, { headers });
      assert.equal(r.status, 204, lang);
      const categoria = translate(lang, "providers.categories.catering");
      const titulo = translate(lang, "providers.seoTitle", { name: datos.businessName, category: categoria });
      const html = [...titulo].map((c) => (c.codePointAt(0) > 126 || "&<>\"'".includes(c) ? `&#${c.codePointAt(0)};` : c)).join("");
      assert.equal(r.headers["x-seo-title"], html, lang);
      assert.equal(r.headers["x-seo-description"], "Bodas &#38; XV a&#241;os", lang);
      assert.match(r.headers["x-seo-image"], new RegExp(`/api/public/providers/images/${foto.id}/1600$`));
    }
    // La dirección anterior lleva a la nueva, con el prefijo del idioma alojado
    await p.call("/provider/profile", "PUT", { ...datos, slug: `${slug}-nueva` });
    const movida = await client().raw(`/internal/seo/providers/${slug}`, { headers: { Host: englishHost, "X-App-Locale": "pt" } });
    assert.equal(movida.status, 401);
    assert.equal(movida.headers["x-seo-redirect"], `/pt/fornecedores/${slug}-nueva`);
    assert.equal((await client().call(`/public/providers/${slug}`)).slug, `${slug}-nueva`);
    // Dirección desconocida o con formato inválido: 404 (403 para nginx), nunca 500
    for (const raro of ["no-existe-ninguno", "..%2Fetc", "MAYUSCULAS", "a".repeat(61)]) {
      assert.equal((await client().raw(`/public/providers/${raro}`)).status, 404, raro);
      assert.equal((await client().raw(`/internal/seo/providers/${raro}`)).status, 403, raro);
    }
    for (const [lang, headers] of locales) {
      const r = await client().raw("/public/providers/no-existe-ninguno", { headers });
      assert.equal(r.data.detail, translate(lang, "errors.providerProfileNotFound"), lang);
    }
    // Sitemap del dominio: sus idiomas, con hreflang a todos; ningún borrador
    const es = await client().raw("/public/sitemap/providers.xml", { headers: { Host: spanishHost } });
    assert.equal(es.status, 200);
    assert.match(es.headers["content-type"], /^application\/xml/);
    assert.match(es.text, new RegExp(`<loc>[^<]+/proveedores/${slug}-nueva</loc>`));
    assert.match(es.text, new RegExp(`hreflang="pt" href="[^"]+/pt/fornecedores/${slug}-nueva"`));
    assert.doesNotMatch(es.text, new RegExp(`<loc>[^<]+/vendors/${slug}-nueva</loc>`));
    const en = await client().raw("/public/sitemap/providers.xml", { headers: { Host: englishHost } });
    for (const ruta of ["/vendors/", "/pt/fornecedores/", "/de/dienstleister/", "/fr/prestataires/"])
      assert.match(en.text, new RegExp(`<loc>[^<]+${ruta}${slug}-nueva</loc>`), ruta);
    await p.call("/provider/unpublish", "POST", {});
    assert.doesNotMatch((await client().raw("/public/sitemap/providers.xml", { headers: { Host: spanishHost } })).text, new RegExp(slug));
  });

  // Servicio de búsqueda en Go (services/search): directo en su puerto, como la API en el suyo
  const buscar = async (query, headers = {}) => {
    const r = await send(`${process.env.TEST_SEARCH_URL || "http://127.0.0.1:3089"}/api/search/providers?${query}`, { headers: { Host: spanishHost, ...headers } });
    return { ...r, data: r.text ? JSON.parse(r.text) : null };
  };

  await suite("Búsqueda de proveedores: texto sin acentos, categoría, distancia, páginas y errores en 5 idiomas", async () => {
    // Solo letras: los trigramas de los dígitos de `unique` coincidirían con otros proveedores de la ejecución
    const marca = `zafiro${String(unique).replace(/\d/g, (d) => "bcdfghjklm"[d])}`;
    const cerca = await proveedorNuevo("busca-cerca");
    await cerca.call("/provider/profile", "PUT", providerData({ businessName: `Florería Ñandú ${marca}`, categories: ["decoration"], geo: { lat: 18.92, lng: -99.23 } }));
    await cerca.call("/provider/services", "POST", { title: "Arco de flores", price: { fromCents: 350000, currency: "MXN", unit: "event" } }, 201);
    const lejos = await proveedorNuevo("busca-lejos");
    await lejos.call("/provider/profile", "PUT", providerData({ businessName: `Banquetes ${marca}`, categories: ["catering"], geo: { lat: 19.43, lng: -99.13 } }));
    for (const p of [cerca, lejos]) await p.call("/provider/images", "POST", { dataUrl: pngDataUrl(), alt: "Foto" }, 201);
    // Un borrador nunca aparece
    assert.equal((await buscar(`q=${marca}`)).data.items.length, 0);
    await cerca.call("/provider/publish", "POST", {});
    await lejos.call("/provider/publish", "POST", {});

    const todos = await buscar(`q=${marca}`);
    assert.equal(todos.status, 200);
    assert.equal(todos.headers["cache-control"], "public, max-age=60");
    assert.equal(todos.data.items.length, 2);
    assert.deepEqual(todos.data.facets.categories, { catering: 1, decoration: 1 });
    const tarjeta = todos.data.items.find((i) => i.categories.includes("decoration"));
    assert.deepEqual(Object.keys(tarjeta).sort(), ["businessName", "categories", "city", "coverUrl", "distanceKm", "headline", "priceFrom", "region", "slug"]);
    assert.deepEqual(tarjeta.priceFrom, { fromCents: 350000, currency: "MXN" });
    // Sin acentos ni mayúsculas, y por el título de un servicio: el que coincide en todo, primero
    assert.equal((await buscar(`q=${encodeURIComponent(`floreria nandu ${marca.toUpperCase()}`)}`)).data.items[0].slug, tarjeta.slug);
    assert.equal((await buscar(`q=${encodeURIComponent(`arco ${marca}`)}`)).data.items[0].slug, tarjeta.slug);
    // Categoría y distancia desde Cuernavaca: la Ciudad de México queda a ~60 km
    assert.deepEqual((await buscar(`q=${marca}&categories=catering`)).data.items.map((i) => i.categories), [["catering"]]);
    const desde = "lat=18.9218&lng=-99.2345";
    assert.equal((await buscar(`q=${marca}&${desde}&radiusKm=30`)).data.items.length, 1);
    const ordenados = (await buscar(`q=${marca}&${desde}&radiusKm=100&sort=distance`)).data.items;
    assert.equal(ordenados.length, 2);
    assert.ok(ordenados[0].distanceKm < 2 && ordenados[1].distanceKm > 50, JSON.stringify(ordenados.map((i) => i.distanceKm)));
    // Páginas: el cursor sigue sin repetir; uno manipulado es un 400
    const primera = await buscar(`q=${marca}&limit=1`);
    assert.ok(primera.data.nextCursor);
    const segunda = await buscar(`q=${marca}&limit=1&cursor=${encodeURIComponent(primera.data.nextCursor)}`);
    assert.notEqual(segunda.data.items[0].slug, primera.data.items[0].slug);
    assert.equal(segunda.data.nextCursor, null);
    assert.equal((await buscar(`q=${marca}&limit=1&${desde}&sort=distance&cursor=${encodeURIComponent(primera.data.nextCursor)}`)).status, 400);
    // Al despublicar sale de la búsqueda en la misma transacción
    await lejos.call("/provider/unpublish", "POST", {});
    assert.equal((await buscar(`q=${marca}`)).data.items.length, 1);

    // Errores: Problem Details con el campo, en el idioma de la página
    for (const [lang, headers] of locales) {
      const r = await buscar("limit=500&color=rojo", headers);
      assert.equal(r.status, 400, lang);
      assert.match(r.headers["content-type"], /^application\/problem\+json/);
      assert.equal(r.headers["content-language"], lang);
      assert.equal(r.data.code, "bad_request");
      assert.equal(r.data.title, translate(lang, "problems.badRequest"), lang);
      const campos = Object.fromEntries(r.data.errors.map((e) => [e.field, e]));
      assert.equal(campos.color.code, "unknown_field");
      assert.equal(campos.limit.message, translate(lang, "search.invalidLimit", { max: 50 }), lang);
    }
    for (const [query, campo, codigo] of [
      [`q=${"a".repeat(101)}`, "q", "too_long"],
      ["categories=pirotecnia", "categories", "invalid_category"],
      ["lat=91&lng=0", "lat", "out_of_range"],
      ["lat=18", "lng", "required"],
      ["sort=distance", "sort", "required"],
      ["cursor=%27%20OR%201%3D1", "cursor", "invalid_format"],
    ]) {
      const r = await buscar(query);
      assert.equal(r.status, 400, query);
      assert.equal(r.data.errors.find((e) => e.field === campo)?.code, codigo, query);
    }
    // SQL en el texto llega como texto
    assert.equal((await buscar(`q=${encodeURIComponent("'; DROP TABLE provider_search; --")}`)).status, 200);
    assert.equal((await buscar("q=")).status, 200);
    const r = await send(`${process.env.TEST_SEARCH_URL || "http://127.0.0.1:3089"}/api/search/otra`);
    assert.equal(r.status, 404);
    assert.equal(JSON.parse(r.text).code, "not_found");
  });

  await suite("Ubicación: el punto del mapa se guarda, se quita y llega a la invitación y al .ics", async () => {
    const organizador = client();
    await organizador.call("/auth/register", "POST", account(P, "geo"), 201);
    const punto = { lat: 18.921831, lng: -99.234567 };
    const evento = await organizador.call("/events", "POST", eventData({ geo: punto }), 201);
    assert.deepEqual(evento.geo, punto);
    // Sin el campo, el punto se conserva; con null, se quita
    assert.deepEqual((await organizador.call(`/events/${evento.id}`, "PATCH", eventData())).geo, punto);
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    assert.deepEqual((await guest.call(`/invitations/${invitacion.token}`)).event.geo, punto);
    assert.match((await guest.raw(`/invitations/${invitacion.token}/calendar.ics`)).text, /\r\nGEO:18\.921831;-99\.234567\r\n/);
    assert.equal((await organizador.call(`/events/${evento.id}`, "PATCH", eventData({ geo: null }))).geo, null);
    assert.equal((await guest.call(`/invitations/${invitacion.token}`)).event.geo, null);
    // Fuera de rango o con campos de más: 422 con el campo
    for (const geo of [{ lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: "19", lng: 0 }, { lat: 1, lng: 1, alt: 3 }]) {
      const r = await organizador.raw(`/events/${evento.id}`, { method: "PATCH", body: eventData({ geo }) });
      assert.equal(r.status, 422, JSON.stringify(geo));
      assert.ok(r.data.errors.some((e) => e.field.startsWith("geo")), r.text);
    }
    await organizador.call(`/events/${evento.id}`, "DELETE");
  });

  await suite("Buscar en el mapa: lugares en el idioma de la petición, sin resultados y geocodificador caído", async () => {
    const lugares = await guest.call(`/geo/search?q=${encodeURIComponent(`Jardín Borda ${unique}`)}`);
    assert.ok(lugares.length >= 1);
    assert.deepEqual(Object.keys(lugares[0]).sort(), ["city", "country", "label", "lat", "lng", "region"]);
    assert.equal(lugares[0].country, "MX");
    assert.deepEqual(await guest.call(`/geo/search?q=${encodeURIComponent(`sin resultados ${unique}`)}`), []);
    const caido = await guest.raw(`/geo/search?q=${encodeURIComponent(`falla ${unique}`)}`);
    assert.equal(caido.status, 503);
    assert.equal(caido.data.code, "geocoder_unavailable");
    assert.ok(!/nominatim|geocoder-fake|fallo de prueba/i.test(caido.text), caido.text);
    const { place } = await guest.call("/geo/reverse?lat=18.9218&lng=-99.2347");
    assert.equal(place.city, "Cuernavaca");
    for (const [path, mensaje] of [
      ["/geo/search?q=ab", "validation.useLeast3Characters"],
      [`/geo/search?q=${"a".repeat(201)}`, "validation.maximum200Characters"],
      ["/geo/reverse?lat=100&lng=0", "validation.invalidCoordinates"],
    ])
      for (const [locale, headers] of [["es", { Host: spanishHost }], ["en", { Host: englishHost }], ["pt", { Host: englishHost, "X-App-Locale": "pt" }], ["de", { Host: englishHost, "X-App-Locale": "de" }], ["fr", { Host: englishHost, "X-App-Locale": "fr" }]]) {
        const r = await client().raw(path, { headers });
        assert.equal(r.status, 400, `${path} → ${r.status}`);
        assert.ok(JSON.stringify(r.data).includes(translate(locale, mensaje)), `${locale} ${path}: ${r.text}`);
      }
    assert.equal((await guest.raw("/geo/search?q=abc&extra=1")).status, 400);
  });

  await suite("Pegar un enlace de mapas: coordenadas de Google, Apple y Waze; otros enlaces se rechazan", async () => {
    const punto = { lat: 18.921831, lng: -99.234567 };
    for (const url of [
      "https://www.google.com/maps/place/X/@18,-99,17z/data=!3d18.921831!4d-99.234567",
      "https://maps.apple.com/?ll=18.921831,-99.234567&q=X",
      "https://waze.com/ul?ll=18.921831,-99.234567&navigate=yes",
    ])
      assert.deepEqual(await guest.call("/geo/parse-link", "POST", { url }), punto, url);
    const sinPunto = await guest.raw("/geo/parse-link", { method: "POST", body: { url: "https://www.google.com/maps/place/Jard%C3%ADn" } });
    assert.equal(sinPunto.status, 422);
    assert.equal(sinPunto.data.code, "geo_link_without_coordinates");
    for (const url of ["https://example.com/?q=18.9,-99.2", "http://maps.google.com/?q=18.9,-99.2", "javascript:alert(1)", `https://maps.google.com/?q=${"1".repeat(2048)}`]) {
      const r = await guest.raw("/geo/parse-link", { method: "POST", body: { url } });
      assert.equal(r.status, 422, url);
      assert.equal(r.data.errors[0].field, "url");
    }
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
