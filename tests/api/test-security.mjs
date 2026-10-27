// Pruebas de seguridad de la API: autenticación, CSRF/origen, aislamiento entre cuentas,
// escalada de privilegios, sesión, fuerza bruta, enumeración, fugas de datos, inyección,
// cabeceras y límites. Corre contra la API real: local (Docker) y GitHub Actions.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { client, account, cleanup, send, base, suiteRunner, eventData, invitationData, password, unique } from "./api.mjs";

const { suite, records } = suiteRunner();
const P = "qa-sec";
const UUID = "00000000-0000-4000-8000-000000000000";
// Origen que la API permite (ALLOWED_ORIGINS): el de la web local.
const origin = process.env.TEST_ORIGIN || "http://localhost:5187";
try {
  const a = client(), b = client(), guest = client();
  await a.call("/auth/register", "POST", account(P, "a"), 201);
  await b.call("/auth/register", "POST", account(P, "b"), 201);
  const evento = await a.call("/events", "POST", eventData(), 201);
  const invitacion = await a.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);

  await suite("Autenticación: sin sesión, todo lo privado responde 401", async () => {
    const protegidos = [
      ["GET", "/auth/me"], ["GET", "/events"], ["POST", "/events"], ["GET", `/events/${evento.id}`],
      ["PATCH", `/events/${evento.id}`], ["DELETE", `/events/${evento.id}`],
      ["GET", `/events/${evento.id}/invitations`], ["POST", `/events/${evento.id}/invitations`],
      ["PUT", `/events/${evento.id}/invitations/${invitacion.id}`], ["DELETE", `/events/${evento.id}/invitations/${invitacion.id}`],
      ["GET", "/notifications"], ["POST", "/notifications/read"], ["PATCH", "/profile"], ["PUT", "/profile/avatar"],
      ["GET", "/owner/metrics"],
    ];
    for (const [method, path] of protegidos) {
      const r = await guest.raw(path, { method, body: method === "GET" || method === "DELETE" ? undefined : {} });
      assert.equal(r.status, 401, `${method} ${path} sin sesión → ${r.status}`);
    }
  });

  await suite("CSRF y origen: las escrituras exigen cabecera propia y un origen permitido", async () => {
    // Sin X-TuEvento-Client no se acepta ninguna escritura, ni con sesión válida
    for (const [method, path] of [["POST", "/events"], ["PATCH", "/profile"], ["POST", "/auth/logout"], ["DELETE", `/events/${evento.id}`]]) {
      const r = await a.raw(path, { method, body: method === "DELETE" ? undefined : {}, csrf: false });
      assert.equal(r.status, 403, `${method} ${path} sin cabecera → ${r.status}`);
    }
    // Origen ajeno con la cabecera correcta
    const ajeno = await a.raw("/events", { method: "POST", body: eventData(), headers: { Origin: "https://evil.example" } });
    assert.equal(ajeno.status, 403);
    // CORS: un origen ajeno no recibe permiso, y el propio sí
    const pre = await send(`${base}/events`, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    assert.ok(!pre.headers["access-control-allow-origin"], "CORS no debe permitir https://evil.example");
    const propio = await send(`${base}/events`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
    assert.equal(propio.headers["access-control-allow-origin"], origin);
    assert.equal(propio.headers["access-control-allow-credentials"], "true");
  });

  await suite("Aislamiento: una cuenta no ve ni toca los datos de otra (IDOR)", async () => {
    await b.call(`/events/${evento.id}`, "GET", undefined, 404);
    await b.call(`/events/${evento.id}`, "PATCH", eventData({ title: "Secuestrado" }), 404);
    await b.call(`/events/${evento.id}`, "DELETE", undefined, 404);
    await b.call(`/events/${evento.id}/invitations`, "GET", undefined, 404);
    await b.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 404);
    await b.call(`/events/${evento.id}/invitations/${invitacion.id}`, "PUT", invitationData({ name: "Robada" }), 404);
    await b.call(`/events/${evento.id}/invitations/${invitacion.id}`, "DELETE", undefined, 404);
    assert.deepEqual(await b.call("/events"), []);
    // Nada cambió para el dueño
    assert.equal((await a.call(`/events/${evento.id}`)).title, evento.title);
    assert.equal((await a.call(`/events/${evento.id}/invitations`)).length, 1);
  });

  await suite("Landing: otra cuenta no la ve, el acceso de un invitado no abre otro evento y la URL no expone el UUID", async () => {
    const { publicCode } = await a.call("/auth/me");
    const landing = `/public/landing/${publicCode}/${evento.slug}`;
    assert.equal(JSON.stringify(await a.call("/auth/me")).includes(publicCode), true);
    assert.equal(publicCode.includes(evento.id.slice(0, 8)), false);
    // Con la sesión de otra cuenta, la landing ajena no existe (404, no 403)
    await b.call(landing, "GET", undefined, 404);
    await guest.call(landing, "GET", undefined, 404);
    // El acceso de una invitación de otro evento no abre esta landing, ni con el nombre de su cookie
    const ajeno = await b.call("/events", "POST", eventData(), 201);
    const suya = await b.call(`/events/${ajeno.id}/invitations`, "POST", invitationData(), 201);
    const invitado = client();
    await invitado.call(`/invitations/${suya.token}/access`, "POST", {});
    await invitado.call(landing, "GET", undefined, 404);
    const valor = invitado.cookie().split("; ").find((c) => c.startsWith(`landing_${ajeno.id}=`)).split("=")[1];
    assert.equal((await guest.raw(landing, { headers: { Cookie: `landing_${evento.id}=${valor}` } })).status, 404);
    // El acceso exige la cabecera propia y un origen permitido, como toda escritura
    assert.equal((await guest.raw(`/invitations/${invitacion.token}/access`, { method: "POST", body: {}, csrf: false })).status, 403);
    // El acceso de un invitado da su invitación y nada más: ni otras invitaciones ni datos de contacto
    const conAcceso = client();
    await conAcceso.call(`/invitations/${invitacion.token}/access`, "POST", {});
    assert.deepEqual(await conAcceso.call(landing), { access: "guest", token: invitacion.token });
  });

  await suite("Dirección pública: solo la cuenta dueña la cambia, y un slug malicioso no encuentra nada", async () => {
    const ruta = `/events/${evento.id}`;
    await guest.raw(ruta, { method: "PATCH", body: eventData({ slug: `seg-${unique}` }) }).then((r) => assert.equal(r.status, 401));
    await b.raw(ruta, { method: "PATCH", body: eventData({ slug: `seg-${unique}` }) }).then((r) => assert.equal(r.status, 404));
    const { publicCode } = await a.call("/auth/me");
    for (const malicioso of ["..%2Fetc", "x'%20OR%201=1--", "%3Cscript%3E", "a%00b"]) {
      await guest.call(`/public/events/${malicioso}`, "GET", undefined, 404);
      await guest.call(`/public/landing/${publicCode}/${malicioso}`, "GET", undefined, 404);
      await guest.call(`/public/landing/${malicioso}/evento`, "GET", undefined, 404);
    }
  });

  await suite("Avisos, contraseña y registro genérico: sin sesión no hay acceso y una contraseña no abre otra página", async () => {
    assert.equal((await guest.raw(`/events/slug-available?slug=abc-${unique}`)).status, 401);
    // Una landing con contraseña no revela nada del evento hasta acertarla
    const codigo = (await a.call("/auth/me")).publicCode;
    const cerrada = `seg-clave-${unique}`;
    const eventoCerrado = await a.call("/events", "POST", eventData({ slug: cerrada, publicPassword: "clave-segura-1" }), 201);
    assert.deepEqual(await guest.call(`/public/landing/${codigo}/${cerrada}`), { access: "locked" });
    assert.equal((await guest.raw(`/public/landing/${codigo}/${cerrada}/unlock`, { method: "POST", body: { password: "nope" } })).status, 401);
    // Un acceso concedido por otra landing no abre esta, ni copiado con su nombre, y un token inventado tampoco
    const otra = `seg-otra-${unique}`;
    const eventoOtro = await a.call("/events", "POST", eventData({ slug: otra, publicPassword: "otra-clave-1" }), 201);
    const visitante = client();
    await visitante.call(`/public/landing/${codigo}/${otra}/unlock`, "POST", { password: "otra-clave-1" });
    assert.deepEqual(await visitante.call(`/public/landing/${codigo}/${cerrada}`), { access: "locked" });
    const valor = visitante.cookie().split("; ").find((c) => c.startsWith(`landing_${eventoOtro.id}=`)).split("=")[1];
    for (const falsa of [valor, "a".repeat(43)])
      assert.deepEqual((await guest.raw(`/public/landing/${codigo}/${cerrada}`, { headers: { Cookie: `landing_${eventoCerrado.id}=${falsa}` } })).data, { access: "locked" });
    // Solo el dueño cambia la contraseña de su página
    assert.equal((await b.raw(`/events/${evento.id}`, { method: "PATCH", body: eventData({ slug: `seg-b-${unique}`, publicPassword: "robada-1" }) })).status, 404);
    // Un enlace personal no acepta registros; y la invitación genérica no muestra a otros invitados
    const personal = await a.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    const generica = await a.call(`/events/${evento.id}/invitations`, "POST", { name: "Abierta", kind: "open", email: "", phone: "", notes: "", members: [] }, 201);
    await guest.raw(`/invitations/${personal.token}/register`, { method: "POST", body: { name: "Ana", kind: "individual", email: "", phone: "", notes: "", members: [{ name: "Ana", kind: "adult", notes: "", status: "pending" }] } })
      .then((r) => assert.equal(r.status, 404));
    assert.equal((await guest.call(`/invitations/${generica.token}`)).members.length, 0);
    // Sin sesión no se puede ver el listado del organizador ni su calendario privado
    assert.equal((await guest.raw(`/events/${evento.id}/invitations`)).status, 401);
    // Y la dirección libre solo para la cuenta que entra
    assert.equal((await b.raw(`/events/slug-available?slug=seg-b-${unique}`)).status, 200);
  });

  await suite("Postal: el color y la sombra del texto solo admiten valores numéricos o hexadecimales, nunca CSS", async () => {
    const ruta = `/events/${evento.id}/postcard`;
    const base = { background: { type: "color", color: "#ffffff" }, photos: [], texts: [] };
    const texto = { content: "Hola", font: "manrope", size: 64, color: "#112233", align: "center", x: 10, y: 10, width: 80 };
    const maliciosos = [
      { ...texto, color: "red;background:url(javascript:alert(1))" },
      { ...texto, shadow: { color: "#000000", blur: "2", x: 0, y: 0 } },
      { ...texto, shadow: { color: "expression(alert(1))", blur: 2, x: 0, y: 0 } },
      { ...texto, shadow: { color: "#000000", blur: 1e9, x: 0, y: 0 } },
    ];
    for (const entrada of maliciosos) {
      await a.call(ruta, "PUT", { ...base, texts: [entrada] }, 422);
    }
    // Un campo desconocido se rechaza (BE-11), también anidado, y nada se guarda
    const extra = await a.raw(ruta, { method: "PUT", body: { ...base, texts: [{ ...texto, shadow: { color: "#000000", blur: 2, x: 0, y: 0, extra: "x" } }] } });
    assert.equal(extra.status, 422);
    assert.ok(extra.data.errors.some((e) => e.field === "texts.0.shadow.extra" && e.code === "unknown_field"), extra.text);
  });

  await suite("Postal: sin sesión o de otra cuenta responde 401 o 404, y las fotos sin id no existen", async () => {
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const ruta = `/events/${evento.id}/postcard`;
    const sinSesion = [["GET", ruta], ["PUT", ruta], ["GET", `${ruta}/versions`], ["POST", `${ruta}/images`], ["DELETE", `${ruta}/images/${UUID}`]];
    for (const [metodo, path] of sinSesion) {
      const r = await guest.raw(path, { method: metodo, body: metodo === "PUT" || metodo === "POST" ? { dataUrl: PNG, background: { type: "color", color: "#ffffff" }, photos: [], texts: [] } : undefined });
      assert.equal(r.status, 401, `${metodo} ${path}`);
    }
    const ajena = [["GET", ruta, undefined], ["PUT", ruta, { background: { type: "color", color: "#ffffff" }, photos: [], texts: [] }], ["GET", `${ruta}/versions`, undefined], ["POST", `${ruta}/images`, { dataUrl: PNG }], ["DELETE", `${ruta}/images/${UUID}`, undefined]];
    for (const [metodo, path, body] of ajena) {
      const r = await b.raw(path, { method: metodo, body });
      assert.equal(r.status, 404, `${metodo} ${path} → ${r.status}`);
    }
    const inexistente = await send(new URL(`/api/postcards/images/${UUID}`, base));
    assert.equal(inexistente.status, 404);
    const malformado = await send(new URL("/api/postcards/images/..%2Fetc%2Fpasswd", base));
    assert.ok([400, 404].includes(malformado.status), String(malformado.status));
  });

  await suite("Demostración: sin cuenta registrada no hay sesión demo", async () => {
    const r = await guest.raw("/auth/demo", { method: "POST", body: {} });
    assert.equal(r.status, 401);
    assert.ok(!(r.headers["set-cookie"] ?? "").includes("session="), "no debe emitir sesión");
  });

  await suite("Privilegios: no se puede escalar por el cuerpo de la petición", async () => {
    const c = client();
    const extra = { isOwner: true, is_owner: true, isDemo: true, id: UUID, locale: "xx", emailVerified: true };
    // Los campos que no son de la entrada se rechazan (422) y no crean nada
    const rechazado = await c.raw("/auth/register", { method: "POST", body: account(P, "priv", extra) });
    assert.equal(rechazado.status, 422);
    for (const campo of Object.keys(extra))
      assert.ok(rechazado.data.errors.some((e) => e.field === campo && e.code === "unknown_field"), `${campo}: ${rechazado.text}`);
    const nuevo = await c.call("/auth/register", "POST", account(P, "priv"), 201);
    assert.equal(nuevo.isOwner, false);
    assert.equal(nuevo.isDemo, false);
    await c.call("/owner/metrics", "GET", undefined, 403);
    // El perfil tampoco acepta campos que no son suyos
    await c.call("/profile", "PATCH", { firstName: "Ana", lastName: "Prueba", phone: "+527770000000", email: "otro@example.invalid", isOwner: true }, 422);
    const perfil = await c.call("/auth/me");
    assert.equal(perfil.email, nuevo.email);
    assert.equal(perfil.isOwner, false);
    await c.call("/owner/metrics", "GET", undefined, 403);
  });

  await suite("Sesión: cookie HttpOnly, SameSite, no adivinable y revocada al salir", async () => {
    const c = client();
    const r = await c.raw("/auth/register", { method: "POST", body: account(P, "ses") });
    assert.equal(r.status, 201);
    // Con HTTPS se llama __Host-session (Secure, Path=/ y sin Domain); sin HTTPS, session
    const cookie = r.setCookie.find((x) => /^(__Host-)?session=/.test(x));
    assert.ok(cookie, "falta la cookie de sesión");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\/(;|$)/i);
    assert.doesNotMatch(cookie, /Domain=/i);
    if (cookie.startsWith("__Host-")) assert.match(cookie, /Secure/i);
    assert.ok(cookie.split(";")[0].split("=")[1].length >= 32, "token demasiado corto");
    // Cookie falsificada o ajena
    for (const falsa of ["session=" + "a".repeat(43), "session=", "session=' OR '1'='1", "session=" + "a".repeat(5000)]) {
      const f = client(); f.setCookie(falsa);
      const x = await f.raw("/auth/me");
      assert.ok([401, 400, 431].includes(x.status), `cookie falsa → ${x.status}`);
    }
    // Un token de A no da acceso a B: cada sesión ve solo lo suyo
    assert.equal((await b.call("/auth/me")).email, account(P, "b").email);
    // Salir revoca el token en el servidor, no solo en el navegador
    const vieja = c.cookie();
    await c.call("/auth/logout", "POST", {}, 201);
    const intento = client(); intento.setCookie(vieja);
    assert.equal((await intento.raw("/auth/me")).status, 401);
  });

  await suite("Fuerza bruta: el inicio de sesión se bloquea tras 5 fallos, por cuenta", async () => {
    const victima = account(P, "fb");
    await client().call("/auth/register", "POST", victima, 201);
    const c = client();
    for (let i = 0; i < 5; i++) assert.equal((await c.raw("/auth/login", { method: "POST", body: { email: victima.email, password: `mala-${i}-clave` } })).status, 401);
    // Bloqueada: ni siquiera la contraseña correcta entra
    const bloqueada = await c.raw("/auth/login", { method: "POST", body: { email: victima.email, password } });
    assert.equal(bloqueada.status, 429);
    assert.ok(Number(bloqueada.headers["retry-after"]) > 0, "falta Retry-After");
    // El bloqueo es de esa cuenta: otra puede entrar
    await client().call("/auth/login", "POST", { email: account(P, "a").email, password }, 201);
  });

  await suite("Sin enumeración de cuentas: misma respuesta exista o no el correo", async () => {
    const existe = await client().raw("/auth/login", { method: "POST", body: { email: account(P, "a").email, password: "incorrecta-123" } });
    const noExiste = await client().raw("/auth/login", { method: "POST", body: { email: `nadie-${Date.now()}@example.invalid`, password: "incorrecta-123" } });
    assert.equal(existe.status, 401);
    assert.equal(noExiste.status, 401);
    // Igual salvo el requestId, que es de cada petición
    const sinId = ({ requestId, ...resto }) => resto;
    assert.deepEqual(sinId(existe.data), sinId(noExiste.data));
    const f1 = await client().raw("/auth/password/forgot", { method: "POST", body: { email: account(P, "a").email } });
    const f2 = await client().raw("/auth/password/forgot", { method: "POST", body: { email: `nadie-${Date.now()}@example.invalid` } });
    assert.equal(f1.status, f2.status);
    assert.deepEqual(f1.data, f2.data);
  });

  await suite("Fugas: ninguna respuesta incluye hashes, tokens internos ni trazas", async () => {
    const prohibido = /password|passwordhash|password_hash|google_sub|token_hash|scrypt|stack|at .*\(.*:\d+:\d+\)/i;
    const mal = await a.raw("/events", { method: "POST", body: "{esto no es json", json: false, headers: { "Content-Type": "application/json" } });
    const respuestas = [
      await a.raw("/auth/me"),
      await client().raw("/auth/login", { method: "POST", body: { email: account(P, "a").email, password } }),
      await a.raw("/profile", { method: "PATCH", body: { firstName: "Ana", lastName: "Prueba", phone: "+527770000000" } }),
      await a.raw(`/events/${evento.id}/invitations`),
      await guest.raw(`/invitations/${invitacion.token}`),
      await guest.raw("/events/no-existe"),
      mal,
    ];
    for (const r of respuestas) assert.ok(!prohibido.test(r.text), `fuga en ${r.status}: ${r.text.slice(0, 200)}`);
    // El portal público de una invitación no expone contactos ni notas privadas
    const publica = JSON.stringify(await guest.call(`/invitations/${invitacion.token}`));
    assert.ok(!publica.includes("prueba@example.invalid"));
    assert.ok(!publica.includes("+527770001111"));
    // JSON mal formado: 400, no 500
    assert.equal(mal.status, 400);
  });

  await suite("Inyección: SQL y HTML llegan como texto, sin ejecutarse", async () => {
    const sqli = "'); DROP TABLE users; --";
    const html = "<img src=x onerror=alert(1)>";
    // En campos libres se guarda y se devuelve idéntico (consultas parametrizadas)
    const e = await a.call("/events", "POST", eventData({ title: sqli, description: html, location: `${sqli}${html}` }), 201);
    const leido = await a.call(`/events/${e.id}`);
    assert.equal(leido.title, sqli);
    assert.equal(leido.description, html);
    // La API responde siempre JSON, nunca HTML interpretable
    assert.match((await a.raw(`/events/${e.id}`)).headers["content-type"], /application\/json/);
    // En login y registro el contenido malicioso se rechaza o falla la autenticación, sin 500
    for (const payload of [sqli, "' OR '1'='1", "admin'--", html]) {
      const login = await client().raw("/auth/login", { method: "POST", body: { email: payload, password: payload } });
      assert.ok([401, 422].includes(login.status), `login con ${payload} → ${login.status}`);
      // "admin'--" solo usa letras, apóstrofo y guion: es un nombre válido y se guarda como texto
      if (payload === "admin'--") continue;
      const registro = await client().raw("/auth/register", { method: "POST", body: { ...account(P, "inj"), firstName: payload } });
      assert.equal(registro.status, 422, `registro con nombre ${payload}`);
    }
    // La tabla de usuarios sigue ahí
    await a.call("/auth/me");
    await client().call("/auth/login", "POST", { email: account(P, "a").email, password }, 201);
  });

  await suite("Cabeceras de seguridad y caché", async () => {
    const r = await guest.raw("/health");
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.ok(r.headers["x-frame-options"] || /frame-ancestors/.test(r.headers["content-security-policy"] ?? ""), "falta protección contra clickjacking");
    assert.ok(!r.headers["x-powered-by"], "no debe anunciar el framework");
    assert.equal(r.headers["cache-control"], "no-store");
    assert.ok(r.headers["strict-transport-security"], "falta HSTS");
    // Las respuestas privadas tampoco se cachean
    assert.equal((await a.raw("/auth/me")).headers["cache-control"], "no-store");
  });

  await suite("Límites: cuerpos enormes y avatares inválidos se rechazan", async () => {
    const enorme = await a.raw("/profile/avatar", { method: "PUT", body: JSON.stringify({ dataUrl: "data:image/png;base64," + "A".repeat(4 * 1024 * 1024) }), json: false, headers: { "Content-Type": "application/json" } });
    assert.equal(enorme.status, 413);
    for (const dataUrl of ["data:text/html;base64,PHNjcmlwdD4=", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "javascript:alert(1)", "no-es-url"]) {
      const r = await a.raw("/profile/avatar", { method: "PUT", body: { dataUrl } });
      assert.equal(r.status, 422, `avatar ${dataUrl.slice(0, 30)} → ${r.status}`);
    }
    // Campos de texto desmesurados: 422 con too_long, sin recortar
    const descripcion = await a.raw("/events", { method: "POST", body: eventData({ description: "x".repeat(2501) }) });
    assert.equal(descripcion.status, 422);
    assert.ok(descripcion.data.errors.some((e) => e.field === "description" && e.code === "too_long"), descripcion.text);
    assert.equal((await a.raw(`/events/${evento.id}/invitations`, { method: "POST", body: invitationData({ notes: "x".repeat(5000) }) })).status, 422);
    // Cuerpo JSON de 1 MB como máximo fuera de las subidas: un login de 2 MB no llega a validarse
    const login = await client().raw("/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b.co", password: "x".repeat(2 * 1024 * 1024) }), json: false, headers: { "Content-Type": "application/json" } });
    assert.equal(login.status, 413);
    assert.match(login.headers["content-type"], /^application\/problem\+json/);
    // Las subidas sí admiten más de 1 MB: llega a validarse la imagen
    const subida = await a.raw("/profile/avatar", { method: "PUT", body: { dataUrl: "data:image/png;base64," + "A".repeat(1.5 * 1024 * 1024) } });
    assert.equal(subida.status, 422);
  });

  await suite("Entradas: las escrituras rechazan los campos desconocidos", async () => {
    const r = await a.raw("/profile", { method: "PATCH", body: { firstName: "Ana", lastName: "Prueba", phone: "", isOwner: true } });
    assert.equal(r.status, 422);
    assert.ok(r.data.errors.some((e) => e.field === "isOwner" && e.code === "unknown_field"), r.text);
    assert.equal((await a.call("/auth/me")).isOwner, false);
  });

  await suite("Límites por cuenta y formulario: 429 con Retry-After", async () => {
    const correo = `${P}-news@example.invalid`;
    for (let i = 0; i < 3; i++)
      assert.equal((await client().raw("/newsletter/subscribe", { method: "POST", body: { email: correo } })).status, 201);
    const cuarta = await client().raw("/newsletter/subscribe", { method: "POST", body: { email: correo } });
    assert.equal(cuarta.status, 429);
    assert.ok(Number(cuarta.headers["retry-after"]) > 0, `Retry-After: ${cuarta.headers["retry-after"]}`);
    assert.equal(cuarta.data.code, "rate_limited");
  });

  await suite("Tipo de cuenta: un proveedor no usa ningún endpoint de eventos, invitaciones, postales ni avisos", async () => {
    const organizador = client();
    await organizador.call("/auth/register", "POST", account(P, "tipo-o"), 201);
    const evento = await organizador.call("/events", "POST", eventData(), 201);
    const invitacion = await organizador.call(`/events/${evento.id}/invitations`, "POST", invitationData(), 201);
    const proveedor = client();
    await proveedor.call("/auth/register", "POST", account(P, "tipo-p", { accountType: "provider" }), 201);
    const id = evento.id, otro = "00000000-0000-4000-8000-000000000000";
    // Toda la API de quien organiza: un endpoint nuevo que se olvide de la guardia aparece aquí
    const rutas = [
      ["GET", "/stream"],
      ["GET", "/events"], ["POST", "/events"], ["GET", "/events/slug-available?slug=abc"],
      ["GET", `/events/${id}`], ["PATCH", `/events/${id}`], ["DELETE", `/events/${id}`],
      ["GET", `/events/${id}/postcard`], ["PUT", `/events/${id}/postcard`], ["GET", `/events/${id}/postcard/versions`],
      ["POST", `/events/${id}/postcard/versions/${otro}/restore`], ["POST", `/events/${id}/postcard/images`], ["DELETE", `/events/${id}/postcard/images/${otro}`],
      ["GET", `/events/${id}/invitations`], ["POST", `/events/${id}/invitations`],
      ["PUT", `/events/${id}/invitations/${invitacion.id}`], ["DELETE", `/events/${id}/invitations/${invitacion.id}`],
      ["GET", "/notifications"], ["POST", "/notifications/read"],
    ];
    for (const [method, path] of rutas) {
      const r = await proveedor.raw(path, { method, body: ["GET", "DELETE"].includes(method) ? undefined : {} });
      assert.equal(r.status, 403, `${method} ${path} → ${r.status}`);
      assert.equal(r.data.code, "wrong_account_type", `${method} ${path}: ${r.text}`);
    }
    // El evento sigue intacto y el proveedor mantiene su perfil
    assert.equal((await organizador.call(`/events/${id}`)).id, id);
    assert.equal((await proveedor.call("/profile", "PATCH", { firstName: "Luis", lastName: "Mora", phone: "" })).firstName, "Luis");
    // Sin sesión sigue siendo 401, no 403
    assert.equal((await client().raw("/events")).status, 401);
  });

  await suite("Mapas: pegar un enlace exige la cabecera propia y no sigue hosts ajenos (SSRF)", async () => {
    const guest = client();
    const body = { url: "https://maps.google.com/?q=18.9,-99.2" };
    assert.equal((await guest.raw("/geo/parse-link", { method: "POST", body, csrf: false })).status, 403);
    assert.equal((await guest.raw("/geo/parse-link", { method: "POST", body, headers: { Origin: "https://evil.example" } })).status, 403);
    // Solo https y hosts de mapas: ni la red interna, ni metadatos de la nube, ni un dominio parecido
    for (const url of [
      "http://geocoder-fake:8080/search?q=x",
      "https://169.254.169.254/latest/meta-data/",
      "https://127.0.0.1/maps/@18.9,-99.2,15z",
      "https://maps.google.com.evil.example/?q=18.9,-99.2",
      "https://evil.example/maps.app.goo.gl/x",
      "file:///etc/passwd",
    ]) {
      const r = await guest.raw("/geo/parse-link", { method: "POST", body: { url } });
      assert.equal(r.status, 422, `${url} → ${r.status}`);
    }
    // La búsqueda trata SQL y HTML como texto
    const r = await guest.raw(`/geo/search?q=${encodeURIComponent(`'; DROP TABLE geo_cache; -- <script>${Date.now()}`)}`);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.headers["content-type"].split(";")[0], "application/json");
  });

  await suite("Errores: Problem Details con requestId y X-Request-ID", async () => {
    const r = await guest.raw("/events");
    assert.equal(r.status, 401);
    assert.match(r.headers["content-type"], /^application\/problem\+json/);
    assert.equal(r.data.type, "about:blank");
    assert.equal(r.data.status, 401);
    assert.equal(r.data.code, "unauthorized");
    assert.ok(r.data.title && r.data.detail, r.text);
    assert.equal(r.data.requestId, r.headers["x-request-id"]);
    // Un X-Request-ID recibido se conserva para seguir la petición en los logs
    const propio = await guest.raw("/health", { headers: { "X-Request-ID": "prueba-1234567890" } });
    assert.equal(propio.headers["x-request-id"], "prueba-1234567890");
    // /api/health solo dice el estado
    assert.deepEqual(propio.data, { status: "ok" });
  });

  mkdirSync("qa-artifacts", { recursive: true });
  writeFileSync("qa-artifacts/security-results.json", JSON.stringify({ date: new Date().toISOString(), tests: records }, null, 2));
  console.log(`${records.length} security checks passed`);
} finally {
  cleanup(P);
}
