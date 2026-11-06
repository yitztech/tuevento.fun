// Endpoints sin cobertura en test-api.mjs, idiomas (es, en, pt, de, fr) y validación de
// entradas. Corre contra la API real: local (Docker) y GitHub Actions.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { translate, supportedLocales, sitePaletteIds, themeIds } from "@tuevento/contracts";
import { base, client, account, verificationToken, cleanup, createCoupon, englishHost, mcpAuthorizeUrl, mcpCall, mcpConnect, mcpFollowToClient, mcpOAuth, mcpStartConsent, mcpTokenRequest, send, spanishHost, suiteRunner, eventData, invitationData, unique, pngDataUrl, providerData } from "./api.mjs";

const { suite, records } = suiteRunner();
const P = "qa-ep";
try {
  const guest = client();

  await suite("GET /site-palette expone solo la paleta activa", async () => {
    const respuesta = await guest.call("/site-palette");
    assert.deepEqual(Object.keys(respuesta), ["palette"]);
    assert.ok(sitePaletteIds.includes(respuesta.palette));
  });

  await suite("GET /config expone solo lo público", async () => {
    const config = await guest.call("/config");
    assert.deepEqual(Object.keys(config).sort(), ["demoEnabled", "googleClientId", "paymentsEnabled"]);
    assert.equal(typeof config.demoEnabled, "boolean");
    // compose.ci.yml conecta los pagos al doble de Stripe; las claves nunca salen en la configuración
    assert.equal(config.paymentsEnabled, true);
    assert.doesNotMatch(JSON.stringify(config), /sk_test|whsec/);
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
    // El organizador ve los fallos desde el último acierto; los invitados con enlace no se ven afectados
    assert.equal((await organizador.call(`/events/${evento.id}`)).passwordFailures, 10);
    assert.equal((await conEnlace.call(landing)).access, "guest");
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
    for (const [campo, valor] of [["firstName", "Ana2"], ["lastName", "123"], ["phone", "abc1234567"], ["phone", "+++++++"], ["phone", "+1 234"], ["phone", "+683 400"], ["phone", "+353 1234567890123"], ["phone", "+34 6123456789012345"], ["password", "corta"], ["firstName", largo(51)], ["email", `${largo(250)}@x.co`]])
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

  await suite("Registro en dos pasos: confirmar el correo y elegir el tipo, con errores en 5 idiomas", async () => {
    const idiomas = [["es", { Host: spanishHost }], ["en", { Host: englishHost }], ["pt", { Host: englishHost, "X-App-Locale": "pt" }], ["de", { Host: englishHost, "X-App-Locale": "de" }], ["fr", { Host: englishHost, "X-App-Locale": "fr" }]];
    const { accountType: _sinTipo, ...datos } = account(P, "dos-pasos");
    const nueva = client({ confirm: false });
    const creada = await nueva.call("/auth/register", "POST", datos, 201);
    assert.equal(creada.mustVerifyEmail, true);
    assert.equal(creada.mustChooseType, true);
    // Sin confirmar: la sesión existe, pero solo sirve para ver la cuenta y reenviar el enlace
    assert.equal((await nueva.call("/auth/me")).mustVerifyEmail, true);
    for (const [locale, headers] of idiomas) {
      const r = await nueva.raw("/events", { headers });
      assert.equal(r.status, 403, locale);
      assert.equal(r.data.code, "email_not_verified", locale);
      assert.equal(r.data.detail, translate(locale, "errors.emailNotVerified"), locale);
    }
    await nueva.call("/profile", "PATCH", { firstName: "Ana", lastName: "Paz", phone: "+527770000000" }, 403);
    await nueva.call("/auth/account-type", "POST", { accountType: "agency" }, 403);
    // Confirmado, falta el tipo: los eventos y el negocio siguen cerrados
    const token = await verificationToken(datos.email);
    assert.equal((await client().call("/auth/email/verify", "POST", { token })).mustVerifyEmail, false);
    for (const [locale, headers] of idiomas) {
      const r = await nueva.raw("/events", { headers });
      assert.equal(r.status, 403, locale);
      assert.equal(r.data.code, "account_type_required", locale);
      assert.equal(r.data.detail, translate(locale, "errors.accountTypeRequired"), locale);
    }
    await nueva.call("/provider/profile", "GET", undefined, 403);
    // Un tipo inválido o un campo de más se rechazan
    const mal = await nueva.raw("/auth/account-type", { method: "POST", body: { accountType: "admin" } });
    assert.equal(mal.status, 422);
    assert.equal(mal.data.errors[0].field, "accountType");
    await nueva.call("/auth/account-type", "POST", { accountType: "agency", isOwner: true }, 422);
    // La agencia usa lo mismo que quien organiza, y el tipo no se vuelve a elegir
    const elegida = await nueva.call("/auth/account-type", "POST", { accountType: "agency" });
    assert.equal(elegida.accountType, "agency");
    assert.equal(elegida.mustChooseType, false);
    await nueva.call("/events", "POST", eventData(), 201);
    await nueva.call("/provider/profile", "GET", undefined, 403);
    for (const [locale, headers] of idiomas) {
      const r = await nueva.raw("/auth/account-type", { method: "POST", body: { accountType: "provider" }, headers });
      assert.equal(r.status, 409, locale);
      assert.equal(r.data.code, "account_type_already_chosen", locale);
      assert.equal(r.data.detail, translate(locale, "errors.accountTypeAlreadyChosen"), locale);
    }
    assert.equal((await nueva.call("/auth/me")).accountType, "agency");
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

  await suite("Proveedor: varias cuentas que guardan a la vez el mismo nombre reciben direcciones distintas, sin 500", async () => {
    const cuentas = await Promise.all(Array.from({ length: 6 }, (_, i) => proveedorNuevo(`prov-carrera-${i}`)));
    const nombre = `Carrera ${unique}`;
    const respuestas = await Promise.all(cuentas.map((c) => c.raw("/provider/profile", { method: "PUT", body: providerData({ businessName: nombre }) })));
    for (const r of respuestas) assert.equal(r.status, 200, r.text);
    const base = `carrera-${unique}`;
    assert.deepEqual(respuestas.map((r) => r.data.slug).sort(), [base, ...[2, 3, 4, 5, 6].map((n) => `${base}-${n}`)].sort());
    // La misma cuenta, dos primeros guardados a la vez: un solo perfil
    const sola = await proveedorNuevo("prov-carrera-doble");
    const dobles = await Promise.all([1, 2].map(() => sola.raw("/provider/profile", { method: "PUT", body: providerData({ businessName: `Doble ${unique}` }) })));
    for (const r of dobles) assert.equal(r.status, 200, r.text);
    assert.equal(dobles[0].data.id, dobles[1].data.id);
    // Una dirección escrita a mano que otra cuenta ocupa a la vez: 409, no 500
    const [x, y] = await Promise.all([proveedorNuevo("prov-carrera-x"), proveedorNuevo("prov-carrera-y")]);
    const manual = `manual-${unique}`;
    const estados = (await Promise.all([x, y].map((c) => c.raw("/provider/profile", { method: "PUT", body: providerData({ slug: manual }) })))).map((r) => r.status);
    assert.deepEqual(estados.sort(), [200, 409]);
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
    for (const privado of ["id", "userId", "email", "status", "missing", "coverImageId", "version"]) assert.ok(!(privado in pagina), privado);
    assert.ok(pagina.services.every((s) => !("version" in s)), "las versiones son del panel del dueño");
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

  await suite("Evento pasado: la invitación se abre en solo lectura y el acceso a la landing caduca un mes después", async () => {
    const organizador = client();
    await organizador.call("/auth/register", "POST", account(P, "pasado"), 201);
    const haceTres = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const pasado = await organizador.call("/events", "POST", eventData({ date: haceTres }), 201);
    const inv = await organizador.call(`/events/${pasado.id}/invitations`, "POST", invitationData(), 201);
    const abierta = await organizador.call(`/events/${pasado.id}/invitations`, "POST", { ...invitationData(), kind: "open", members: [] }, 201);
    const invitado = await guest.call(`/invitations/${inv.token}`);
    assert.equal(invitado.event.date, pasado.date);
    const locales = [
      ["es", { Host: spanishHost }],
      ["en", { Host: englishHost }],
      ["pt", { Host: englishHost, "X-App-Locale": "pt" }],
      ["de", { Host: englishHost, "X-App-Locale": "de" }],
      ["fr", { Host: englishHost, "X-App-Locale": "fr" }],
    ];
    for (const [locale, headers] of locales) {
      const r = await guest.raw(`/invitations/${inv.token}/rsvp`, { method: "POST", headers, body: { members: invitado.members.map((m) => ({ id: m.id, status: "accepted" })) } });
      assert.equal(r.status, 409, locale);
      assert.equal(r.data.detail, translate(locale, "errors.eventAlreadyHappened"), locale);
    }
    const registro = await guest.raw(`/invitations/${abierta.token}/register`, { method: "POST", body: { name: "Tarde", email: "", phone: "", notes: "", kind: "individual", members: [{ name: "Tarde", kind: "adult", notes: "", status: "accepted" }] } });
    assert.equal(registro.status, 409);
    // El acceso a la landing desde el enlace dura hasta un mes después del evento (aquí, 27 días)
    const acceso = await client().raw(`/invitations/${inv.token}/access`, { method: "POST", body: {} });
    const maxAge = Number(/Max-Age=(\d+)/i.exec(acceso.setCookie.find((c) => c.startsWith(`landing_${pasado.id}=`)))[1]);
    assert.ok(Math.abs(maxAge - 27 * 86400) < 120, `Max-Age ${maxAge}`);
    // Con el evento por delante, el acceso dura como mucho 180 días
    const futuro = await organizador.call("/events", "POST", eventData(), 201);
    const invFuturo = await organizador.call(`/events/${futuro.id}/invitations`, "POST", invitationData(), 201);
    const accesoFuturo = await client().raw(`/invitations/${invFuturo.token}/access`, { method: "POST", body: {} });
    const maxFuturo = Number(/Max-Age=(\d+)/i.exec(accesoFuturo.setCookie.find((c) => c.startsWith(`landing_${futuro.id}=`)))[1]);
    assert.ok(maxFuturo <= 180 * 86400 && maxFuturo > 86400, `Max-Age ${maxFuturo}`);
  });

  await suite("Confirmar el correo y darse de baja: errores traducidos en 5 idiomas", async () => {
    const locales = [
      ["es", { Host: spanishHost }],
      ["en", { Host: englishHost }],
      ["pt", { Host: englishHost, "X-App-Locale": "pt" }],
      ["de", { Host: englishHost, "X-App-Locale": "de" }],
      ["fr", { Host: englishHost, "X-App-Locale": "fr" }],
    ];
    for (const [locale, headers] of locales) {
      const caducado = await guest.raw("/auth/email/verify", { method: "POST", headers, body: { token: "x".repeat(43) } });
      assert.equal(caducado.status, 400, locale);
      assert.equal(caducado.data.detail, translate(locale, "errors.emailVerificationLinkInvalid"), locale);
      const malFormado = await guest.raw("/auth/email/verify", { method: "POST", headers, body: { token: "corto" } });
      assert.equal(malFormado.status, 422, locale);
      assert.equal(malFormado.data.errors[0].field, "token");
      const baja = await guest.raw("/mail/unsubscribe", { method: "POST", headers, body: { h: "x".repeat(43), s: "y".repeat(43) } });
      assert.equal(baja.status, 400, locale);
      assert.equal(baja.data.detail, translate(locale, "errors.unsubscribeLinkInvalid"), locale);
    }
    // Una cuenta nueva empieza sin confirmar; el reenvío tiene límite por cuenta
    const nueva = client({ confirm: false });
    assert.equal((await nueva.call("/auth/register", "POST", account(P, "confirmar"), 201)).emailVerified, false);
    for (let i = 0; i < 3; i++) await nueva.call("/auth/email/resend", "POST", {}, 200);
    const cuarto = await nueva.raw("/auth/email/resend", { method: "POST", body: {} });
    assert.equal(cuarto.status, 429);
    assert.ok(Number(cuarto.headers["retry-after"]) > 0);
  });

  await suite("Pagar un evento: tramo inválido, ya pagado o demasiado pequeño, con errores en 5 idiomas", async () => {
    const locales = [
      ["es", { Host: spanishHost }],
      ["en", { Host: englishHost }],
      ["pt", { Host: englishHost, "X-App-Locale": "pt" }],
      ["de", { Host: englishHost, "X-App-Locale": "de" }],
      ["fr", { Host: englishHost, "X-App-Locale": "fr" }],
    ];
    const owner = client();
    await owner.call("/auth/register", "POST", account(P, "pago"), 201);
    const event = await owner.call("/events", "POST", eventData(), 201);
    assert.equal(event.paidTier, null);
    // 51 personas: el tramo de 50 ya no las cubre
    const people = (n) => Array.from({ length: n }, () => ({ name: "Invitado", kind: "adult", notes: "" }));
    await owner.call(`/events/${event.id}/invitations`, "POST", { ...invitationData(), members: people(50) }, 201);
    await owner.call(`/events/${event.id}/invitations`, "POST", { ...invitationData(), members: people(1) }, 201);
    for (const [locale, headers] of locales) {
      const invalido = await owner.raw(`/events/${event.id}/checkout`, { method: "POST", headers, body: { tier: 9 } });
      assert.equal(invalido.status, 422, locale);
      assert.equal(invalido.data.errors[0].field, "tier");
      assert.equal(invalido.data.errors[0].message, translate(locale, "errors.paymentTierInvalid"), locale);
      const pequeno = await owner.raw(`/events/${event.id}/checkout`, { method: "POST", headers, body: { tier: 0 } });
      assert.equal(pequeno.status, 409, locale);
      assert.equal(pequeno.data.detail, translate(locale, "errors.paymentTierTooSmall"), locale);
    }
    // Stripe recibe el idioma de la petición, la versión fijada de su API y una caducidad de 31 minutos
    const stripeLocales = { es: "es-419", en: "en", pt: "pt-BR", de: "de", fr: "fr" };
    const otro = client();
    await otro.call("/auth/register", "POST", account(P, "pago-idiomas"), 201);
    const otroEvento = await otro.call("/events", "POST", eventData(), 201);
    for (const [locale, headers] of locales) {
      const abierto = await otro.raw(`/events/${otroEvento.id}/checkout`, { method: "POST", headers, body: { tier: 1 } });
      assert.equal(abierto.status, 200, locale);
      const sesion = abierto.data.url.replace("/pay/", "/v1/checkout/sessions/");
      const leida = JSON.parse((await send(sesion, { headers: { Authorization: "Bearer sk_test_ci" } })).text);
      assert.equal(leida.locale, stripeLocales[locale], locale);
      assert.match(leida.stripe_version, /^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
      assert.ok(Math.abs(leida.expires_at - Date.now() / 1000 - 31 * 60) < 120, locale);
    }
    const { url } = await owner.call(`/events/${event.id}/checkout`, "POST", { tier: 1 });
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/pay\/cs_test_/);
    await send(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "action=pay" });
    assert.equal((await owner.call(`/events/${event.id}`)).paidTier, 1);
    for (const [locale, headers] of locales) {
      const pagado = await owner.raw(`/events/${event.id}/checkout`, { method: "POST", headers, body: { tier: 1 } });
      assert.equal(pagado.status, 409, locale);
      assert.equal(pagado.data.detail, translate(locale, "errors.paymentTierAlreadyPaid"), locale);
    }
    // La demostración no se cobra
    const demo = client();
    await demo.call("/auth/register", "POST", account(P, "pago-demo"), 201);
    await demo.call("/auth/demo", "POST", {}, 201);
    const [demoEvent] = await demo.call("/events");
    const r = await demo.raw(`/events/${demoEvent.id}/checkout`, { method: "POST", body: { tier: 3 } });
    assert.equal(r.status, 409);
    assert.equal(r.data.detail, translate("es", "errors.paymentDemo"));
  });

  await suite("POST /coupons/check responde en cada idioma y valida el código", async () => {
    const owner = client();
    await owner.call("/auth/register", "POST", account(P, "cupon"), 201);
    const cupon = await createCoupon({ amountOffCents: 150 });
    assert.deepEqual(await owner.call("/coupons/check", "POST", { code: ` ${cupon.code.toLowerCase()} ` }), { code: cupon.code, percentOff: null, amountOffCents: 150 });
    const idiomas = [["es", {}], ["en", { Host: englishHost }]];
    for (const [locale, headers] of idiomas) {
      const r = await owner.raw("/coupons/check", { method: "POST", headers, body: { code: "NO-EXISTE" } });
      assert.equal(r.status, 422, locale);
      assert.equal(r.data.code, "coupon_invalid");
      assert.equal(r.data.detail, translate(locale, "errors.couponInvalid"), locale);
    }
    const largo = await owner.raw("/coupons/check", { method: "POST", body: { code: "A".repeat(33) } });
    assert.equal(largo.status, 422);
    assert.equal(largo.data.errors[0].field, "code");
    assert.equal(largo.data.errors[0].message, translate("es", "validation.maximum32Characters"));
    for (const code of ["ab", "con espacio", "ÑANDÚ", 7, null]) {
      const r = await owner.raw("/coupons/check", { method: "POST", body: { code } });
      assert.equal(r.status, 422, String(code));
    }
  });

  await suite("MCP OAuth: descubrimiento, código con PKCE, solo lectura, renovación, revocación y un emisor por dominio", async () => {
    // Descubrimiento: el 401 lleva al recurso, y el recurso al servidor de autorización
    const unauthorized = await send(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    assert.equal(unauthorized.status, 401);
    assert.match(unauthorized.headers["www-authenticate"], /^Bearer resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/api\/mcp", scope="mcp:read"$/);

    const resource = await guest.call("/.well-known/oauth-protected-resource");
    assert.equal(resource.resource, mcpOAuth.resource);
    assert.deepEqual(resource.scopes_supported, ["mcp:read"]);
    assert.deepEqual(resource.authorization_servers, [`${mcpOAuth.resource}/oauth`]);
    const englishMetadata = await guest.call("/.well-known/oauth-protected-resource", "GET", undefined, 200, { Host: englishHost });
    assert.notEqual(englishMetadata.resource, resource.resource);

    const server = await guest.call("/mcp/oauth/.well-known/openid-configuration");
    assert.equal(server.issuer, resource.authorization_servers[0]);
    assert.deepEqual(server.code_challenge_methods_supported, ["S256"]);
    assert.deepEqual(server.response_types_supported, ["code"]);
    assert.deepEqual(server.token_endpoint_auth_methods_supported, ["none", "private_key_jwt"]);
    assert.equal(server.client_id_metadata_document_supported, true);
    assert.equal(server.authorization_response_iss_parameter_supported, true);
    assert.ok(!server.scopes_supported.includes("mcp:write"));

    // Flujo completo de un organizador
    const org = client();
    await org.call("/auth/register", "POST", account(P, "mcp-oauth-org"), 201);
    const flow = await mcpStartConsent(org);
    const details = await org.call(`/mcp/oauth/interaction/${flow.uid}/details`);
    assert.deepEqual(details, { clientName: "Cliente de pruebas", scopes: ["mcp:read"] });
    const { redirectTo } = await org.call(`/mcp/oauth/interaction/${flow.uid}/decision`, "POST", { allow: true });
    const callback = await mcpFollowToClient(org, redirectTo);
    assert.equal(callback.get("state"), flow.state);
    assert.equal(callback.get("iss"), server.issuer);

    const exchange = { grant_type: "authorization_code", code: callback.get("code"), redirect_uri: mcpOAuth.redirectUri, resource: mcpOAuth.resource };
    // Sin el verificador de PKCE, o con otro, no hay token
    assert.equal((await mcpTokenRequest({ ...exchange, code_verifier: "x".repeat(43) })).data.error, "invalid_grant");
    const connected = await mcpConnect(org);
    assert.equal(connected.tokens.token_type.toLowerCase(), "bearer");
    assert.equal(connected.tokens.scope, "mcp:read");
    assert.equal(connected.tokens.expires_in, 3600);
    assert.ok(connected.tokens.refresh_token);

    // Volver a conectar con la sesión OAuth abierta en el mismo navegador
    assert.equal((await mcpConnect(org)).tokens.scope, "mcp:read");

    // Un código solo vale una vez
    const reused = await mcpTokenRequest({
      grant_type: "authorization_code",
      code: connected.params.get("code"),
      code_verifier: connected.verifier,
      redirect_uri: mcpOAuth.redirectUri,
      resource: mcpOAuth.resource,
    });
    assert.equal(reused.data.error, "invalid_grant");
    // Y repetirlo revoca lo que se emitió con él: alguien más pudo haberlo robado
    assert.equal((await mcpCall(connected.tokens.access_token, "tools/list")).status, 401);

    // Solo lectura: las herramientas de escritura ni aparecen ni responden
    const active = await mcpConnect(org);
    const access = active.tokens.access_token;
    const init = await mcpCall(access, "initialize", { protocolVersion: "2025-06-18" });
    assert.equal(init.body.result.protocolVersion, "2025-06-18");
    assert.equal((await mcpCall(access, "initialize", { protocolVersion: "1999-01-01" })).body.result.protocolVersion, "2025-11-25");
    const tools = (await mcpCall(access, "tools/list")).body.result.tools;
    assert.ok(tools.some((tool) => tool.name === "events_list"));
    assert.ok(!tools.some((tool) => tool.name === "events_create"));
    for (const tool of tools) {
      assert.deepEqual(tool.securitySchemes, [{ type: "oauth2", scopes: ["mcp:read"] }]);
      assert.deepEqual(tool._meta.securitySchemes, tool.securitySchemes);
      assert.equal(tool.annotations.readOnlyHint, true);
    }
    const write = await mcpCall(access, "tools/call", { name: "events_create", arguments: {} });
    assert.equal(write.body.result.isError, true);
    assert.match(write.body.result.content[0].text, /mcp:write/);
    assert.ok(Array.isArray(JSON.parse((await mcpCall(access, "tools/call", { name: "events_list", arguments: {} })).body.result.content[0].text).events));

    // Una notificación no lleva respuesta
    const notification = await send(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    assert.equal(notification.status, 202);

    // Un token solo vale en el dominio que lo emitió
    const otherDomain = await mcpCall(access, "tools/list", undefined, englishHost);
    assert.equal(otherDomain.status, 401);
    assert.match(otherDomain.headers["www-authenticate"], /error="invalid_token"/);

    // Renovar da un token nuevo y sigue siendo de solo lectura
    const refreshed = await mcpTokenRequest({ grant_type: "refresh_token", refresh_token: active.tokens.refresh_token, resource: mcpOAuth.resource });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
    assert.equal(refreshed.data.scope, "mcp:read");
    assert.equal((await mcpCall(refreshed.data.access_token, "tools/list")).status, 200);

    // Revocar corta el acceso
    const revocation = await send(`${base}/mcp/oauth/token/revocation`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: mcpOAuth.clientId, token: refreshed.data.access_token }).toString(),
    });
    assert.equal(revocation.status, 200);
    assert.equal((await mcpCall(refreshed.data.access_token, "tools/list")).status, 401);

    // Un proveedor también se conecta, con sus herramientas de lectura
    const provider = client();
    await provider.call("/auth/register", "POST", account(P, "mcp-oauth-prov", { accountType: "provider" }), 201);
    const providerTools = (await mcpCall((await mcpConnect(provider)).tokens.access_token, "tools/list")).body.result.tools.map((tool) => tool.name);
    assert.deepEqual(providerTools.sort(), ["provider_profile_get", "provider_services_list"]);

    // El consentimiento sale en el idioma pedido, en el de la cuenta o en el del dominio
    const english = { Host: englishHost };
    const consentRedirect = async (user, query, headers) => {
      const start = await user.raw(mcpAuthorizeUrl(query).path, { headers });
      const uid = /\/interaction\/([^/?]+)/.exec(start.headers.location)?.[1];
      assert.ok(uid, start.text.slice(0, 200));
      return (await user.raw(`/mcp/oauth/interaction/${uid}`, { headers })).headers.location.split("?")[0];
    };
    const englishResource = { resource: englishMetadata.resource };
    for (const [locale, page] of [["en", "/conectar-asistente"], ["pt", "/pt/conectar-asistente"], ["de", "/de/conectar-asistente"], ["fr", "/fr/conectar-asistente"], ["pt-BR", "/pt/conectar-asistente"], ["es", "/conectar-asistente"]])
      assert.equal(await consentRedirect(client(), { ...englishResource, ui_locales: locale }, english), page, locale);
    assert.equal(await consentRedirect(client(), { ui_locales: "pt" }), "/conectar-asistente");
    const french = client();
    await french.call("/auth/register", "POST", account(P, "mcp-oauth-fr"), 201, { ...english, "X-App-Locale": "fr" });
    assert.equal(await consentRedirect(french, englishResource, english), "/fr/conectar-asistente");

    // Rechazar vuelve al cliente con access_denied y sin código
    const denied = await mcpStartConsent(org);
    const refused = await org.call(`/mcp/oauth/interaction/${denied.uid}/decision`, "POST", { allow: false });
    const deniedCallback = await mcpFollowToClient(org, refused.redirectTo);
    assert.equal(deniedCallback.get("error"), "access_denied");
    assert.equal(deniedCallback.get("code"), null);
  });

  await suite("Model Context Protocol (MCP): Streamable HTTP, initialize, catálogo de herramientas y ejecución con confirmación", async () => {
    // 1. Estado
    const status = await guest.call("/mcp");
    assert.equal(status.status, "ok");
    assert.equal(status.service, "tuevento-mcp");
    assert.equal(status.protocolVersion, "2025-11-25");

    // 2. Organizador: emitir token MCP
    const org = client();
    await org.call("/auth/register", "POST", account(P, "mcp-org"), 201);
    const orgAuth = await org.call("/mcp/tokens", "POST", { client_name: "Claude Test", scopes: ["mcp:read", "mcp:write"] });
    assert.match(orgAuth.access_token, /^mcp_/);
    assert.equal(orgAuth.actor_type, "organizer");
    assert.equal(orgAuth.token_type, "Bearer");

    const mcpOrg = async (method, params, extraHeaders = {}) => {
      const res = await send(`${base}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${orgAuth.access_token}`,
          ...extraHeaders,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      return { status: res.status, headers: res.headers, body: JSON.parse(res.text) };
    };

    // 3. Negociación: initialize y ping
    const initRes = await mcpOrg("initialize");
    assert.equal(initRes.status, 200);
    assert.equal(initRes.body.result.protocolVersion, "2025-11-25");
    assert.equal(initRes.body.result.serverInfo.name, "tuevento-mcp");

    const pingRes = await mcpOrg("ping");
    assert.equal(pingRes.status, 200);
    assert.deepEqual(pingRes.body.result, {});

    // 4. Catálogo de herramientas para organizador
    const toolsRes = await mcpOrg("tools/list");
    const toolNames = toolsRes.body.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes("events_list"));
    assert.ok(toolNames.includes("events_create"));
    assert.ok(toolNames.includes("invitations_create"));
    assert.ok(toolNames.includes("providers_search"));
    assert.ok(!toolNames.includes("provider_profile_get"));

    // 5. Creación de evento con vista previa y confirmación
    const eventParams = {
      title: "Boda MCP Elegante",
      date: "2026-12-15T19:00:00Z",
      timeZone: "America/Mexico_City",
      location: "Jardín Los Encinos",
      theme: "gold",
    };
    // Llamada con preview: true devuelve vista previa y token de confirmación
    const previewRes = await mcpOrg("tools/call", {
      name: "events_create",
      arguments: { ...eventParams, preview: true },
    });
    const previewData = JSON.parse(previewRes.body.result.content[0].text);
    assert.equal(previewData.preview, true);
    assert.equal(previewData.requiresConfirmation, true);
    assert.ok(previewData.confirmationToken);

    // Confirmación con el token generado
    const confirmRes = await mcpOrg("tools/call", {
      name: "events_create",
      arguments: {
        ...eventParams,
        confirmed: true,
        confirmation_token: previewData.confirmationToken,
      },
    });
    const createdEventData = JSON.parse(confirmRes.body.result.content[0].text);
    assert.equal(createdEventData.success, true);
    assert.equal(createdEventData.event.title, "Boda MCP Elegante");
    const mcpEventId = createdEventData.event.id;

    // events_list refleja el nuevo evento
    const listRes = await mcpOrg("tools/call", { name: "events_list", arguments: {} });
    const listData = JSON.parse(listRes.body.result.content[0].text);
    assert.ok(listData.events.some((e) => e.id === mcpEventId));

    // events_get devuelve los detalles
    const getRes = await mcpOrg("tools/call", { name: "events_get", arguments: { id: mcpEventId } });
    const getData = JSON.parse(getRes.body.result.content[0].text);
    assert.equal(getData.event.id, mcpEventId);

    // Crear invitación mediante MCP
    const invPreview = await mcpOrg("tools/call", {
      name: "invitations_create",
      arguments: {
        eventId: mcpEventId,
        name: "Familia Gómez",
        kind: "family",
        contact: "5512345678",
        members: [{ name: "Roberto", kind: "adult" }, { name: "Sofía", kind: "child" }],
        preview: true,
      },
    });
    const invPreviewData = JSON.parse(invPreview.body.result.content[0].text);
    assert.ok(invPreviewData.confirmationToken);

    const invConfirm = await mcpOrg("tools/call", {
      name: "invitations_create",
      arguments: {
        eventId: mcpEventId,
        name: "Familia Gómez",
        kind: "family",
        contact: "5512345678",
        members: [{ name: "Roberto", kind: "adult" }, { name: "Sofía", kind: "child" }],
        confirmed: true,
        confirmation_token: invPreviewData.confirmationToken,
      },
    });
    const invData = JSON.parse(invConfirm.body.result.content[0].text);
    assert.equal(invData.success, true);
    const mcpInvId = invData.invitation.id;
    const invToken = invData.invitation.token;

    // Resumen de asistencia
    const summaryRes = await mcpOrg("tools/call", {
      name: "events_attendance_summary",
      arguments: { eventId: mcpEventId },
    });
    const summaryData = JSON.parse(summaryRes.body.result.content[0].text);
    assert.equal(summaryData.totalGuests, 2);
    assert.equal(summaryData.pending, 2);

    // 6. Flujo de Invitado con token breve
    const guestTokenRes = await guest.call("/mcp/guest-token", "POST", { invitation_token: invToken });
    assert.match(guestTokenRes.access_token, /^mcp_/);
    assert.equal(guestTokenRes.actor_type, "guest");

    const mcpGuest = async (method, params) => {
      const res = await send(`${base}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${guestTokenRes.access_token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }),
      });
      return { status: res.status, body: JSON.parse(res.text) };
    };

    // Herramientas del invitado: solo 3
    const guestToolsRes = await mcpGuest("tools/list");
    const guestToolNames = guestToolsRes.body.result.tools.map((t) => t.name);
    assert.deepEqual(guestToolNames.sort(), ["invitation_get", "invitation_rsvp_get", "invitation_rsvp_update"]);

    // invitation_get obtiene solo su invitación
    const gGetRes = await mcpGuest("tools/call", { name: "invitation_get", arguments: {} });
    const gGetData = JSON.parse(gGetRes.body.result.content[0].text);
    assert.equal(gGetData.invitation.id, mcpInvId);
    assert.equal(gGetData.invitation.members.length, 2);
    const memberId = gGetData.invitation.members[0].id;

    // Responder RSVP con confirmación
    const rsvpPreview = await mcpGuest("tools/call", {
      name: "invitation_rsvp_update",
      arguments: {
        members: [{ id: memberId, status: "accepted" }],
        preview: true,
      },
    });
    const rsvpPreviewData = JSON.parse(rsvpPreview.body.result.content[0].text);
    assert.ok(rsvpPreviewData.confirmationToken);

    const rsvpConfirm = await mcpGuest("tools/call", {
      name: "invitation_rsvp_update",
      arguments: {
        members: [{ id: memberId, status: "accepted" }],
        confirmed: true,
        confirmation_token: rsvpPreviewData.confirmationToken,
      },
    });
    const rsvpData = JSON.parse(rsvpConfirm.body.result.content[0].text);
    assert.equal(rsvpData.success, true);
    assert.equal(rsvpData.members.find((m) => m.id === memberId).status, "accepted");

    // 7. Flujo de Proveedor: perfil y servicios
    const prov = client();
    await prov.call("/auth/register", "POST", account(P, "mcp-prov", { accountType: "provider" }), 201);
    const provAuth = await prov.call("/mcp/tokens", "POST", { client_name: "Claude Provider" });
    const mcpProv = async (method, params) => {
      const res = await send(`${base}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provAuth.access_token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method, params }),
      });
      return { status: res.status, body: JSON.parse(res.text) };
    };

    const provToolsRes = await mcpProv("tools/list");
    const provToolNames = provToolsRes.body.result.tools.map((t) => t.name);
    assert.deepEqual(provToolNames.sort(), [
      "provider_profile_get",
      "provider_profile_update",
      "provider_services_list",
      "provider_services_update",
    ]);

    // Actualizar perfil de proveedor con confirmación
    const profPreview = await mcpProv("tools/call", {
      name: "provider_profile_update",
      arguments: {
        businessName: "Estudio Creativo MCP",
        headline: "Fotografía y video profesional",
        categories: ["photo-video"],
        preview: true,
      },
    });
    const profPreviewData = JSON.parse(profPreview.body.result.content[0].text);
    assert.ok(profPreviewData.confirmationToken);

    const profConfirm = await mcpProv("tools/call", {
      name: "provider_profile_update",
      arguments: {
        businessName: "Estudio Creativo MCP",
        headline: "Fotografía y video profesional",
        categories: ["photo-video"],
        confirmed: true,
        confirmation_token: profPreviewData.confirmationToken,
      },
    });
    const profData = JSON.parse(profConfirm.body.result.content[0].text);
    assert.equal(profData.success, true);
    assert.equal(profData.profile.businessName, "Estudio Creativo MCP");

    // Crear servicio de proveedor con confirmación
    const servPreview = await mcpProv("tools/call", {
      name: "provider_services_update",
      arguments: {
        action: "create",
        title: "Fotografía y Video 4K",
        description: "Cobertura completa",
        price: { fromCents: 1200000, currency: "MXN", unit: "event" },
        preview: true,
      },
    });
    const servPreviewData = JSON.parse(servPreview.body.result.content[0].text);
    assert.ok(servPreviewData.confirmationToken);

    const servConfirm = await mcpProv("tools/call", {
      name: "provider_services_update",
      arguments: {
        action: "create",
        title: "Fotografía y Video 4K",
        description: "Cobertura completa",
        price: { fromCents: 1200000, currency: "MXN", unit: "event" },
        confirmed: true,
        confirmation_token: servPreviewData.confirmationToken,
      },
    });
    const servData = JSON.parse(servConfirm.body.result.content[0].text);
    assert.equal(servData.success, true);
    assert.equal(servData.service.title, "Fotografía y Video 4K");

    // 8. Streamable HTTP (SSE)
    const sseRes = await send(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${orgAuth.access_token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "ping" }),
    });
    assert.equal(sseRes.status, 200);
    assert.match(sseRes.headers["content-type"], /^text\/event-stream/);
    assert.match(sseRes.text, /event: message\ndata: \{"jsonrpc":"2.0","id":99,"result":\{\}\}/);
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

  // ── Sincronización sin conexión (fase 8a) ──
  /** Todas las páginas desde `cursor` con `limit`, y el cursor final. */
  const todasLasPaginas = async (api, cursor, limit = 100) => {
    const paginas = [];
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const q = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
      const pagina = await api.call(`/sync/changes?${q}`);
      paginas.push(pagina);
      cursor = pagina.nextCursor;
      if (!pagina.hasMore) return { paginas, cursor };
    }
    throw new Error("La sincronización no terminó en 50 páginas");
  };
  const claves = (paginas) =>
    paginas.flatMap((p) => [
      ...p.events.map((e) => `event:${e.id}`),
      ...p.invitations.map((i) => `invitation:${i.id}`),
      ...p.notifications.map((n) => `notification:${n.id}`),
      ...(p.provider ? [`provider:${p.provider.id}`] : []),
    ]);
  const cursorCon = (s, t) => Buffer.from(JSON.stringify({ v: 1, s, t })).toString("base64url");
  const secuenciaDe = (cursor) => JSON.parse(Buffer.from(cursor, "base64url").toString()).s;

  await suite("Sincronización: sin cursor, todo por páginas sin huecos ni duplicados; después, solo lo cambiado y lo borrado", async () => {
    const org = client();
    await org.call("/auth/register", "POST", account(P, "sync"), 201);
    const eventos = [];
    for (let n = 0; n < 3; n++) eventos.push(await org.call("/events", "POST", eventData({ title: `Sync ${n}` }), 201));
    const inv1 = await org.call(`/events/${eventos[0].id}/invitations`, "POST", invitationData(), 201);
    const inv2 = await org.call(`/events/${eventos[0].id}/invitations`, "POST", invitationData({ name: "Otra" }), 201);
    const esperadas = [...eventos.map((e) => `event:${e.id}`), `invitation:${inv1.id}`, `invitation:${inv2.id}`].sort();

    // De dos en dos: cada dato una sola vez y ninguno se queda fuera
    const { paginas, cursor } = await todasLasPaginas(org, undefined, 2);
    assert.ok(paginas.length >= 3, `páginas: ${paginas.length}`);
    assert.ok(paginas.slice(0, -1).every((p) => p.hasMore && claves([p]).length === 2));
    assert.deepEqual(claves(paginas).sort(), esperadas);
    assert.ok(paginas.every((p) => p.deleted.length === 0), "sin cursor no hay borrados");
    const ev = paginas.flatMap((p) => p.events).find((e) => e.id === eventos[0].id);
    assert.equal(ev.version, 1);
    assert.equal(typeof ev.updatedAt, "string");
    const inv = paginas.flatMap((p) => p.invitations).find((i) => i.id === inv1.id);
    assert.equal(inv.members.length, 1, "la invitación viaja con sus personas");
    assert.equal(inv.version, 1);

    // Con el cursor final, nada nuevo
    const quieto = await org.call(`/sync/changes?cursor=${cursor}`);
    assert.deepEqual([quieto.events, quieto.invitations, quieto.notifications, quieto.deleted, quieto.hasMore], [[], [], [], [], false]);
    // Solo la secuencia: el cursor lleva el segundo en que se emite y cambia entre dos llamadas
    assert.equal(secuenciaDe(quieto.nextCursor), secuenciaDe(cursor));
    assert.match(quieto.nextCursor, /^[A-Za-z0-9_-]+$/);

    // Un cambio del organizador: solo ese evento, con la versión siguiente
    await org.call(`/events/${eventos[1].id}`, "PATCH", eventData({ title: "Sync cambiado" }));
    const cambio = await org.call(`/sync/changes?cursor=${cursor}`);
    assert.deepEqual(claves([cambio]), [`event:${eventos[1].id}`]);
    assert.equal(cambio.events[0].title, "Sync cambiado");
    assert.equal(cambio.events[0].version, 2);

    // Responde un invitado: su invitación (con la respuesta, misma versión) y el aviso
    await client().call(`/invitations/${inv1.token}/rsvp`, "POST", { members: inv1.members.map((m) => ({ id: m.id, status: "accepted" })) }, 201);
    const respuesta = await org.call(`/sync/changes?cursor=${cambio.nextCursor}`);
    assert.deepEqual(respuesta.invitations.map((i) => i.id), [inv1.id]);
    assert.equal(respuesta.invitations[0].members[0].status, "accepted");
    assert.equal(respuesta.invitations[0].version, 1, "la respuesta de un invitado no cambia la versión de la invitación");
    assert.equal(respuesta.notifications.length, 1);
    assert.equal(respuesta.notifications[0].eventId, eventos[0].id);

    // Borrar: la invitación sola; después el evento, que se lleva su otra invitación y el aviso
    await org.call(`/events/${eventos[0].id}/invitations/${inv2.id}`, "DELETE");
    const sinInv = await org.call(`/sync/changes?cursor=${respuesta.nextCursor}`);
    assert.deepEqual(sinInv.deleted, [{ entity: "invitation", id: inv2.id }]);
    await org.call(`/events/${eventos[0].id}`, "DELETE");
    const sinEvento = await org.call(`/sync/changes?cursor=${sinInv.nextCursor}`);
    assert.deepEqual(
      sinEvento.deleted.map((d) => `${d.entity}:${d.id}`).sort(),
      [`event:${eventos[0].id}`, `invitation:${inv1.id}`, `notification:${respuesta.notifications[0].id}`].sort(),
    );
    for (const e of eventos.slice(1)) await org.call(`/events/${e.id}`, "DELETE");
  });

  await suite("Sincronización: cursor inválido 400, caducado 410 y límite acotado, en los cinco idiomas", async () => {
    const org = client();
    await org.call("/auth/register", "POST", account(P, "sync-cursor"), 201);
    const locales = [
      ["es", { Host: spanishHost }],
      ["en", { Host: englishHost }],
      ["pt", { Host: englishHost, "X-App-Locale": "pt" }],
      ["de", { Host: englishHost, "X-App-Locale": "de" }],
      ["fr", { Host: englishHost, "X-App-Locale": "fr" }],
    ];
    const viejo = cursorCon(0, Math.floor(Date.now() / 1000) - 91 * 24 * 60 * 60);
    for (const [locale, headers] of locales) {
      const caducado = await org.raw(`/sync/changes?cursor=${viejo}`, { headers });
      assert.equal(caducado.status, 410, locale);
      assert.equal(caducado.data.code, "sync_cursor_expired");
      assert.equal(caducado.data.title, translate(locale, "problems.gone"), locale);
      assert.equal(caducado.data.detail, translate(locale, "errors.syncCursorExpired"), locale);
      const roto = await org.raw("/sync/changes?cursor=no-es-un-cursor", { headers });
      assert.equal(roto.status, 400, locale);
      assert.equal(roto.data.code, "invalid_sync_cursor");
      assert.equal(roto.data.detail, translate(locale, "errors.invalidSyncCursor"), locale);
    }
    for (const cursor of [cursorCon("1", 1), cursorCon(-5, Math.floor(Date.now() / 1000)), Buffer.from("[]").toString("base64url")])
      assert.equal((await org.raw(`/sync/changes?cursor=${cursor}`)).status, 400, cursor);
    for (const limit of ["0", "101", "dos"]) assert.equal((await org.raw(`/sync/changes?limit=${limit}`)).status, 400, limit);
    assert.equal((await org.raw("/sync/changes?otro=1")).status, 400, "parámetro desconocido");
    const ahora = await org.raw(`/sync/changes?cursor=${cursorCon(0, Math.floor(Date.now() / 1000))}`);
    assert.equal(ahora.status, 200);
    assert.match(ahora.headers["cache-control"] ?? "", /no-store/);
  });

  await suite("If-Match: con la versión guardada se cambia; con otra, 409 version_conflict con la versión actual", async () => {
    const org = client();
    await org.call("/auth/register", "POST", account(P, "ifmatch"), 201);
    const ev = await org.call("/events", "POST", eventData(), 201);
    const cambiado = await org.call(`/events/${ev.id}`, "PATCH", eventData({ title: "Primera" }), 200, { "If-Match": '"1"' });
    assert.equal(cambiado.version, 2);
    for (const [locale, headers] of [["es", { Host: spanishHost }], ["en", { Host: englishHost }], ["pt", { Host: englishHost, "X-App-Locale": "pt" }], ["de", { Host: englishHost, "X-App-Locale": "de" }], ["fr", { Host: englishHost, "X-App-Locale": "fr" }]]) {
      const tarde = await org.raw(`/events/${ev.id}`, { method: "PATCH", body: eventData({ title: "Tarde" }), headers: { ...headers, "If-Match": '"1"' } });
      assert.equal(tarde.status, 409, locale);
      assert.equal(tarde.data.code, "version_conflict");
      assert.equal(tarde.data.currentVersion, 2);
      assert.equal(tarde.data.detail, translate(locale, "errors.versionConflict"), locale);
    }
    assert.equal((await org.call(`/events/${ev.id}`)).title, "Primera", "el cambio tardío no se guardó");
    // W/"2" y 2 también valen; sin If-Match, como siempre (la web y las apps anteriores)
    assert.equal((await org.call(`/events/${ev.id}`, "PATCH", eventData({ title: "Segunda" }), 200, { "If-Match": 'W/"2"' })).version, 3);
    assert.equal((await org.call(`/events/${ev.id}`, "PATCH", eventData({ title: "Tercera" }), 200, { "If-Match": "3" })).version, 4);
    assert.equal((await org.call(`/events/${ev.id}`, "PATCH", eventData({ title: "Cuarta" }))).version, 5);
    // La web reenvía el evento entero: version y updatedAt no rompen el esquema estricto
    const entero = await org.call(`/events/${ev.id}`);
    assert.equal((await org.call(`/events/${ev.id}`, "PATCH", { ...entero, title: "Quinta" })).title, "Quinta");
    for (const valor of ["abc", '"0"', '"1', "*"]) {
      const r = await org.raw(`/events/${ev.id}`, { method: "PATCH", body: eventData(), headers: { "If-Match": valor } });
      assert.equal(r.status, 400, valor);
      assert.equal(r.data.code, "invalid_if_match");
    }
    // Invitaciones
    const inv = await org.call(`/events/${ev.id}/invitations`, "POST", invitationData(), 201);
    const ruta = `/events/${ev.id}/invitations/${inv.id}`;
    const editada = await org.call(ruta, "PUT", invitationData({ notes: "Una", members: inv.members.map(({ id, name, kind, notes }) => ({ id, name, kind, notes })) }), 200, { "If-Match": '"1"' });
    assert.equal(editada.version, 2);
    const choque = await org.raw(ruta, { method: "PUT", body: invitationData({ notes: "Dos" }), headers: { "If-Match": '"1"' } });
    assert.equal(choque.status, 409);
    assert.equal(choque.data.code, "version_conflict");
    assert.equal(choque.data.currentVersion, 2);
    assert.equal((await org.call(`/events/${ev.id}/invitations`)).find((i) => i.id === inv.id).notes, "Una");
    await org.call(`/events/${ev.id}`, "DELETE");
  });

  await suite("Proveedor: If-Match en el perfil y los servicios; la sincronización trae el perfil con todo dentro", async () => {
    const prov = client();
    await prov.call("/auth/register", "POST", account(P, "sync-prov", { accountType: "provider" }), 201);
    const perfil = await prov.call("/provider/profile", "PUT", providerData({ businessName: `Sync ${unique}` }));
    assert.equal(perfil.version, 1);
    const inicio = await prov.call("/sync/changes");
    assert.equal(inicio.provider?.id, perfil.id);
    assert.deepEqual([inicio.events, inicio.invitations, inicio.notifications], [[], [], []]);
    // Un servicio nuevo toca el perfil (llega por la sincronización) sin subir su versión
    const servicio = await prov.call("/provider/services", "POST", { title: "Banquete", description: "", price: null }, 201);
    assert.equal(servicio.version, 1);
    const tocado = await prov.call(`/sync/changes?cursor=${inicio.nextCursor}`);
    assert.equal(tocado.provider?.version, 1);
    assert.deepEqual(tocado.provider?.services.map((s) => s.id), [servicio.id]);
    // Perfil
    assert.equal((await prov.call("/provider/profile", "PUT", providerData({ businessName: `Sync ${unique}`, headline: "Uno" }), 200, { "If-Match": '"1"' })).version, 2);
    const choque = await prov.raw("/provider/profile", { method: "PUT", body: providerData({ businessName: `Sync ${unique}`, headline: "Dos" }), headers: { "If-Match": '"1"' } });
    assert.equal(choque.status, 409);
    assert.equal(choque.data.code, "version_conflict");
    assert.equal(choque.data.currentVersion, 2);
    // Servicio
    const ruta = `/provider/services/${servicio.id}`;
    assert.equal((await prov.call(ruta, "PUT", { title: "Banquete grande", description: "", price: null }, 200, { "If-Match": '"1"' })).version, 2);
    const tarde = await prov.raw(ruta, { method: "PUT", body: { title: "Tarde", description: "", price: null }, headers: { "If-Match": '"1"' } });
    assert.equal(tarde.status, 409);
    assert.equal(tarde.data.currentVersion, 2);
    assert.equal((await prov.raw(`/provider/services/${crypto.randomUUID()}`, { method: "PUT", body: { title: "Otro servicio", description: "", price: null }, headers: { "If-Match": '"1"' } })).status, 404);
  });

  await suite("ID del cliente: crear dos veces con el mismo id devuelve lo guardado; un id ajeno, 409 id_taken", async () => {
    const org = client(), otra = client();
    await org.call("/auth/register", "POST", account(P, "clientid"), 201);
    await otra.call("/auth/register", "POST", account(P, "clientid-otra"), 201);
    const id = crypto.randomUUID();
    const primera = await org.call("/events", "POST", eventData({ id, title: "Desde el teléfono" }), 201);
    assert.equal(primera.id, id);
    const repetida = await org.raw("/events", { method: "POST", body: eventData({ id, title: "Desde el teléfono" }) });
    assert.ok([200, 201].includes(repetida.status), repetida.text);
    assert.equal(repetida.data.id, id);
    assert.equal((await org.call("/events")).filter((e) => e.id === id).length, 1);
    const ajena = await otra.raw("/events", { method: "POST", body: eventData({ id }) });
    assert.equal(ajena.status, 409);
    assert.equal(ajena.data.code, "id_taken");
    assert.equal(ajena.data.id, undefined, "no devuelve el evento de la otra cuenta");
    assert.equal((await org.raw("/events", { method: "POST", body: eventData({ id: "no-es-uuid" }) })).status, 422);
    // Invitaciones: dentro del mismo evento se repite; en otro evento, 409
    const invId = crypto.randomUUID();
    const inv = await org.call(`/events/${id}/invitations`, "POST", invitationData({ id: invId }), 201);
    assert.equal(inv.id, invId);
    const otraVez = await org.raw(`/events/${id}/invitations`, { method: "POST", body: invitationData({ id: invId }) });
    assert.ok([200, 201].includes(otraVez.status), otraVez.text);
    assert.equal((await org.call(`/events/${id}/invitations`)).length, 1);
    const otroEvento = await org.call("/events", "POST", eventData(), 201);
    const cruzada = await org.raw(`/events/${otroEvento.id}/invitations`, { method: "POST", body: invitationData({ id: invId }) });
    assert.equal(cruzada.status, 409);
    assert.equal(cruzada.data.code, "id_taken");
    await org.call(`/events/${id}`, "DELETE");
    await org.call(`/events/${otroEvento.id}`, "DELETE");
  });

  await suite("Idempotency-Key: repetir devuelve la misma respuesta sin repetir el efecto; otro cuerpo, 422", async () => {
    const org = client();
    await org.call("/auth/register", "POST", account(P, "idem"), 201);
    const key = crypto.randomUUID();
    const primera = await org.raw("/events", { method: "POST", body: eventData({ title: "Una vez" }), headers: { "Idempotency-Key": key } });
    assert.equal(primera.status, 201);
    assert.equal(primera.headers["idempotency-replayed"], undefined);
    const segunda = await org.raw("/events", { method: "POST", body: eventData({ title: "Una vez" }), headers: { "Idempotency-Key": key } });
    assert.equal(segunda.status, 201);
    assert.equal(segunda.headers["idempotency-replayed"], "true");
    assert.deepEqual(segunda.data, primera.data);
    assert.equal((await org.call("/events")).filter((e) => e.title === "Una vez").length, 1);
    const otroCuerpo = await org.raw("/events", { method: "POST", body: eventData({ title: "Otra cosa" }), headers: { "Idempotency-Key": key } });
    assert.equal(otroCuerpo.status, 422);
    assert.equal(otroCuerpo.data.code, "idempotency_key_reused");
    const otraRuta = await org.raw(`/events/${primera.data.id}`, { method: "PATCH", body: eventData({ title: "Una vez" }), headers: { "Idempotency-Key": key } });
    assert.equal(otraRuta.status, 422);
    const rota = await org.raw("/events", { method: "POST", body: eventData(), headers: { "Idempotency-Key": "123" } });
    assert.equal(rota.status, 400);
    assert.equal(rota.data.code, "invalid_idempotency_key");
    // Un error no se guarda: con la misma clave y el cuerpo corregido, se crea
    const k2 = crypto.randomUUID();
    assert.equal((await org.raw("/events", { method: "POST", body: eventData({ title: "" }), headers: { "Idempotency-Key": k2 } })).status, 422);
    assert.equal((await org.raw("/events", { method: "POST", body: eventData({ title: "Corregido" }), headers: { "Idempotency-Key": k2 } })).status, 201);
    // Borrar dos veces con la misma clave: la segunda repite el 200, no da 404
    const k3 = crypto.randomUUID();
    const borrar = () => org.raw(`/events/${primera.data.id}`, { method: "DELETE", headers: { "Idempotency-Key": k3 } });
    assert.equal((await borrar()).status, 200);
    const repetido = await borrar();
    assert.equal(repetido.status, 200);
    assert.equal(repetido.headers["idempotency-replayed"], "true");
    assert.equal((await org.raw(`/events/${primera.data.id}`, { method: "DELETE" })).status, 404);
  });

  mkdirSync("qa-artifacts", { recursive: true });
  writeFileSync("qa-artifacts/endpoints-results.json", JSON.stringify({ date: new Date().toISOString(), tests: records }, null, 2));
  console.log(`${records.length} endpoint checks passed`);
} finally {
  cleanup(P);
}
