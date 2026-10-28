import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
const base = process.env.TEST_API_URL || "http://127.0.0.1:3087/api";
// Dominio inglés de desarrollo (mismo valor que SITE_URL_EN del compose).
const englishHost = new URL(
  process.env.TEST_SITE_URL_EN || "http://yourevent.localhost:5187",
).hostname;
// API de Mailpit (compose.yml y compose.ci.yml): ahí llegan los correos de la API
const mailpit = process.env.TEST_MAILPIT_URL || "http://127.0.0.1:8026";
/** Último correo a `address` cuyo asunto cumple `subject`, esperando a que llegue. */
async function mailTo(address, subject) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
    ).then((r) => r.json());
    const found = list.messages?.find((m) => subject.test(m.Subject));
    if (found)
      return fetch(`${mailpit}/api/v1/message/${found.ID}`).then((r) => r.json());
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No llegó a ${address} un correo con asunto ${subject}`);
}
/** Correos a `address` cuyo asunto cumple `subject`, tras dar tiempo a que lleguen los pendientes. */
async function mailsTo(address, subject, settleMs = 1500) {
  await new Promise((resolve) => setTimeout(resolve, settleMs));
  const list = await fetch(
    `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=200`,
  ).then((r) => r.json());
  return (list.messages ?? []).filter((m) => subject.test(m.Subject));
}
const records = [],
  users = [];
const suite = async (name, fn) => {
  await fn();
  records.push({ name, passed: true });
  console.log("PASS", name);
};
/**
 * fetch() de Node no permite fijar Host, y el idioma de la API depende del Host.
 * Esta petición mínima con node:http/https sí lo permite.
 */
function send(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, { method, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, text }),
      );
    });
    request.on("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}
function client() {
  let cookie = "";
  return {
    async call(path, method = "GET", body, expected = 200, headers = {}) {
      const r = await send(base + path, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          "X-TuEvento-Client": "1",
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const set = r.headers["set-cookie"];
      if (set?.length) cookie = set[0].split(";")[0];
      const data = JSON.parse(r.text || "{}");
      assert.equal(r.status, expected, JSON.stringify(data));
      return data;
    },
    cookie: () => cookie,
  };
}
const a = client(),
  b = client(),
  guest = client();
let event, invitation, other;
const unique = Date.now(),
  password = randomBytes(20).toString("hex");
const account = (n) => ({
  firstName: "Prueba",
  lastName: "Automática",
  email: `qa-${unique}-${n}@example.invalid`,
  phone: "+527770000000",
  password,
});
/** Evento siempre futuro: un día después de su fecha queda en solo lectura. */
const eventPayload = (extra = {}) => ({
  title: "QA · Avisos",
  description: "",
  date: `${new Date().getUTCFullYear() + 1}-12-20T23:00:00Z`,
  timeZone: "America/Mexico_City",
  location: "Jardín de pruebas",
  theme: "floral",
  ...extra,
});
try {
  await suite("Salud de API y PostgreSQL", async () =>
    assert.equal((await guest.call("/health")).status, "ok"),
  );
  await suite(
    "Sesión obligatoria para eventos y validación de registro",
    async () => {
      await guest.call("/events", "GET", undefined, 401);
      await guest.call("/auth/register", "POST", { email: "bad" }, 422);
    },
  );
  await suite("Registro aislado y cookie de sesión HttpOnly", async () => {
    for (const [c, n] of [
      [a, 1],
      [b, 2],
    ]) {
      const u = await c.call("/auth/register", "POST", account(n), 201);
      users.push(u.id);
      assert.equal(u.isDemo, false);
    }
    assert.ok(a.cookie().startsWith("session="));
    assert.deepEqual(await a.call("/events"), []);
  });
  await suite(
    "Rechazo de duplicados, credenciales inválidas y CSRF",
    async () => {
      await guest.call("/auth/register", "POST", account(1), 409);
      await guest.call(
        "/auth/login",
        "POST",
        { email: account(1).email, password: "incorrecta" },
        401,
      );
      await a.call("/events", "POST", {}, 403, {
        "X-TuEvento-Client": "",
        Origin: "https://evil.invalid",
      });
    },
  );
  await suite(
    "Crear evento, validación de fecha y aislamiento por propietario",
    async () => {
      const data = {
        title: "QA · Celebración",
        description: "Traer alegría",
        date: `${new Date().getUTCFullYear() + 1}-12-20T23:00:00Z`,
        timeZone: "America/Mexico_City",
        location: "Jardín de pruebas",
        theme: "floral",
      };
      await a.call("/events", "POST", { ...data, date: "no-date" }, 422);
      event = await a.call("/events", "POST", data, 201);
      assert.equal(event.metrics.people, 0);
      await b.call(`/events/${event.id}`, "GET", undefined, 404);
      await b.call(`/events/${event.id}`, "PATCH", data, 404);
    },
  );
  await suite(
    "Invitación familiar, desglose de edades y token privado",
    async () => {
      invitation = await a.call(
        `/events/${event.id}/invitations`,
        "POST",
        {
          name: "Familia de prueba",
          kind: "family",
          email: "prueba@example.invalid",
          phone: "+527770000001",
          notes: "Privado",
          members: [
            { name: "Ana García", kind: "adult", notes: "Alergia privada" },
            { name: "Luis García", kind: "adult", notes: "" },
            { name: "Luna García", kind: "child", notes: "Sin nueces" },
          ],
        },
        201,
      );
      assert.equal(invitation.token.length, 32);
      const e = await a.call(`/events/${event.id}`);
      assert.equal(e.metrics.people, 3);
      assert.equal(e.metrics.adults, 2);
      assert.equal(e.metrics.children, 1);
      assert.equal(e.metrics.pending, 3);
      await b.call(`/events/${event.id}/invitations`, "GET", undefined, 404);
    },
  );
  await suite("Portal público excluye contactos y notas internas", async () => {
    const p = await guest.call(`/invitations/${invitation.token}`);
    assert.equal(p.members.length, 3);
    for (const key of ["email", "phone", "notes", "userId"])
      assert.equal(key in p, false);
    assert.equal("notes" in p.members[0], false);
    assert.equal(p.host.firstName, "Prueba");
  });
  await suite(
    "RSVP rechaza IDs ajenos, duplicados y respuestas incompletas",
    async () => {
      const path = `/invitations/${invitation.token}/rsvp`;
      await guest.call(
        path,
        "POST",
        { members: [{ id: randomUUID(), status: "accepted" }] },
        400,
      );
      await guest.call(
        path,
        "POST",
        { members: [{ id: invitation.members[0].id, status: "accepted" }] },
        400,
      );
      await guest.call(
        path,
        "POST",
        {
          members: [
            ...invitation.members.map((m) => ({
              id: m.id,
              status: "accepted",
            })),
            { id: invitation.members[0].id, status: "pending" },
          ],
        },
        422,
      );
    },
  );
  await suite(
    "RSVP individual actualiza métricas y notifica al anfitrión por SSE",
    async () => {
      const controller = new AbortController();
      const response = await fetch(base + "/stream", {
        headers: { Cookie: a.cookie() },
        signal: controller.signal,
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/event-stream/);
      const reader = response.body.getReader();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        await guest.call(
          `/invitations/${invitation.token}/rsvp`,
          "POST",
          {
            members: invitation.members.map((m, i) => ({
              id: m.id,
              status: ["accepted", "pending", "declined"][i],
            })),
          },
          201,
        );
        let data = "";
        while (!data.includes("changed")) {
          const part = await reader.read();
          if (part.done) break;
          data += new TextDecoder().decode(part.value);
        }
        assert.ok(data.includes("changed"));
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
      const e = await a.call(`/events/${event.id}`);
      assert.equal(e.metrics.accepted, 1);
      assert.equal(e.metrics.pending, 1);
      assert.equal(e.metrics.declined, 1);
      const n = await a.call("/notifications");
      assert.equal(n.length, 1);
      assert.equal(n[0].guestName, "Familia de prueba");
      assert.equal(n[0].read, false);
      assert.deepEqual(await b.call("/notifications"), []);
    },
  );
  await suite(
    "Idioma por dominio: el Host decide, Accept-Language se ignora",
    async () => {
      const en = { Host: englishHost };
      const invalid = await guest.call(
        "/auth/login",
        "POST",
        { email: "bad", password: "" },
        422,
        en,
      );
      assert.equal(invalid.message, "Enter a valid email address.");
      const www = await guest.call(
        "/auth/login",
        "POST",
        { email: "bad", password: "" },
        422,
        { Host: `www.${englishHost}` },
      );
      assert.equal(www.message, "Enter a valid email address.");
      const missing = await guest.call("/auth/register", "POST", {}, 422, en);
      assert.match(missing.message, /Invalid input/);
      // Accept-Language en un Host desconocido no cambia el idioma: sigue es
      const ignored = await guest.call(
        "/auth/login",
        "POST",
        { email: "bad", password: "" },
        422,
        { "Accept-Language": "en-US,en;q=0.9" },
      );
      assert.equal(ignored.message, "Escribe un correo válido.");
      const unknown = await guest.call(
        "/auth/login",
        "POST",
        { email: "bad", password: "" },
        422,
        { Host: "sub." + englishHost, "Accept-Language": "en" },
      );
      assert.equal(unknown.message, "Escribe un correo válido.");
      const notifications = await a.call(
        "/notifications",
        "GET",
        undefined,
        200,
        en,
      );
      assert.equal(
        notifications[0].message,
        "1 attending, 1 not attending and 1 pending.",
      );
      const spanish = await a.call("/notifications", "GET", undefined, 200, {
        "Accept-Language": "en",
      });
      assert.match(spanish[0].message, /confirmado/);
      const original = await a.call(
        `/events/${event.id}`,
        "GET",
        undefined,
        200,
        en,
      );
      assert.equal(original.title, "QA · Celebración");
      const health = await send(base + "/health", { headers: en });
      assert.equal(health.headers["content-language"], "en");
      const other = await send(base + "/health", {
        headers: { "Accept-Language": "en" },
      });
      assert.equal(other.headers["content-language"], "es");
    },
  );
  await suite(
    "El idioma de la cuenta se guarda con el dominio del registro",
    async () => {
      const english = client(),
        spanish = client();
      const created = await english.call(
        "/auth/register",
        "POST",
        account("en"),
        201,
        { Host: englishHost, "Accept-Language": "es" },
      );
      users.push(created.id);
      assert.equal(created.locale, "en");
      // La sesión es por dominio, pero la cuenta conserva su idioma en cualquiera
      assert.equal((await english.call("/auth/me")).locale, "en");
      const local = await spanish.call(
        "/auth/register",
        "POST",
        account("es"),
        201,
        { "Accept-Language": "en-US" },
      );
      users.push(local.id);
      assert.equal(local.locale, "es");
    },
  );
  await suite("RSVP idempotente y marcado de notificaciones", async () => {
    await guest.call(
      `/invitations/${invitation.token}/rsvp`,
      "POST",
      {
        members: invitation.members.map((m, i) => ({
          id: m.id,
          status: ["accepted", "pending", "declined"][i],
        })),
      },
      201,
    );
    assert.equal((await a.call("/notifications")).length, 1);
    await a.call("/notifications/read", "POST", {}, 201);
    assert.equal((await a.call("/notifications"))[0].read, true);
  });
  await suite(
    "Editar y eliminar integrantes conserva estados y recalcula métricas",
    async () => {
      // Solo los campos de entrada: la API rechaza los de solo lectura (id, token, status…)
      const { name, email, phone, notes, kind } = invitation;
      const { id, kind: memberKind, notes: memberNotes } = invitation.members[0];
      const payload = {
        name, email, phone, notes, kind,
        members: [
          { id, kind: memberKind, notes: memberNotes, name: "Ana Actualizada" },
          { name: "Nuevo Niño", kind: "child", notes: "Menú infantil" },
        ],
      };
      const updated = await a.call(
        `/events/${event.id}/invitations/${invitation.id}`,
        "PUT",
        payload,
      );
      assert.equal(updated.members[0].status, "accepted");
      assert.equal(updated.members[1].status, "pending");
      assert.equal(updated.token, invitation.token);
      const e = await a.call(`/events/${event.id}`);
      assert.equal(e.metrics.people, 2);
      assert.equal(e.metrics.children, 1);
      other = updated;
    },
  );
  await suite(
    "No permite transferir integrantes entre invitaciones",
    async () => {
      await a.call(
        `/events/${event.id}/invitations`,
        "POST",
        {
          name: "Otra persona",
          kind: "individual",
          members: [{ id: other.members[0].id, name: other.members[0].name, kind: other.members[0].kind, notes: other.members[0].notes }],
        },
        400,
      );
    },
  );
  await suite(
    "Avatar valida contenido binario; perfil guarda cambios",
    async () => {
      await a.call(
        "/profile/avatar",
        "PUT",
        { dataUrl: "data:image/jpeg;base64,aG9sYQ==" },
        422,
      );
      const u = await a.call("/profile", "PATCH", {
        firstName: "Organizador",
        lastName: "Pruebas",
        phone: "+527770000000",
      });
      assert.equal(u.firstName, "Organizador");
    },
  );
  await suite(
    "Archivar desactiva enlaces y reactivar los recupera",
    async () => {
      await a.call(`/events/${event.id}`, "PATCH", {
        ...event,
        archived: true,
      });
      await guest.call(
        `/invitations/${invitation.token}`,
        "GET",
        undefined,
        404,
      );
      await a.call(`/events/${event.id}`, "PATCH", {
        ...event,
        archived: false,
      });
      await guest.call(`/invitations/${invitation.token}`);
    },
  );
  await suite(
    "Cerrar sesión revoca acceso; inicio de sesión recupera datos",
    async () => {
      const old = a.cookie();
      await a.call("/auth/logout", "POST", {}, 201);
      await a.call("/events", "GET", undefined, 401, { Cookie: old });
      await a.call(
        "/auth/login",
        "POST",
        { email: account(1).email, password },
        201,
      );
      assert.equal((await a.call("/events")).length, 1);
    },
  );
  await suite(
    "Recuperar contraseña: correo en el idioma y desde el dominio por el que entra",
    async () => {
      const owner = client(),
        data = account("reset");
      const created = await owner.call("/auth/register", "POST", data, 201);
      users.push(created.id);
      const en = { Host: englishHost };
      // Misma respuesta exista o no la cuenta
      const unknown = await guest.call(
        "/auth/password/forgot",
        "POST",
        { email: `qa-${unique}-nadie@example.invalid` },
        201,
        en,
      );
      const known = await guest.call(
        "/auth/password/forgot",
        "POST",
        { email: data.email.toUpperCase() },
        201,
        en,
      );
      assert.equal(unknown.message, known.message);
      assert.match(known.message, /^If that email has an account/);
      const mail = await mailTo(data.email, /^Reset your TuEventoFun password$/);
      assert.equal(mail.From.Address, "no-reply@yourevent.localhost");
      const link = new URL(mail.Text.match(/https?:\/\/\S+\?token=[\w-]{43}/)[0]);
      assert.equal(link.hostname, englishHost);
      assert.equal(link.pathname, "/nueva-contrasena");
      const token = link.searchParams.get("token");
      const before = owner.cookie(),
        renewed = client(),
        newPassword = randomBytes(20).toString("hex");
      await renewed.call(
        "/auth/password/reset",
        "POST",
        { token, password: "corta" },
        422,
        en,
      );
      const changed = await renewed.call(
        "/auth/password/reset",
        "POST",
        { token, password: newPassword },
        201,
        en,
      );
      assert.equal(changed.email, data.email);
      // Entró por el dominio inglés: la cuenta pasa a inglés
      assert.equal(changed.locale, "en");
      assert.equal((await renewed.call("/auth/me")).id, created.id);
      // Cierra las demás sesiones; el enlace es de un solo uso
      await owner.call("/auth/me", "GET", undefined, 401, { Cookie: before });
      const reused = await client().call(
        "/auth/password/reset",
        "POST",
        { token, password: newPassword },
        400,
        en,
      );
      assert.equal(reused.message, "The password reset link is invalid or has expired.");
      await client().call(
        "/auth/login",
        "POST",
        { email: data.email, password: data.password },
        401,
      );
      await client().call(
        "/auth/login",
        "POST",
        { email: data.email, password: newPassword },
        201,
      );
      const notice = await mailTo(data.email, /^Your TuEventoFun password was changed$/);
      assert.equal(notice.From.Address, "no-reply@yourevent.localhost");
      // Desde el dominio español: correo en español, desde tuevento y con enlace a tuevento
      const spanish = await guest.call(
        "/auth/password/forgot",
        "POST",
        { email: data.email },
        201,
      );
      assert.match(spanish.message, /^Si ese correo tiene una cuenta/);
      const es = await mailTo(data.email, /^Restablece tu contraseña de TuEventoFun$/);
      assert.equal(es.From.Address, "no-reply@tuevento.localhost");
      assert.match(es.Text, /http:\/\/tuevento\.localhost:5187\/nueva-contrasena\?token=[\w-]{43}/);
      // Un enlace inventado se rechaza
      const invalid = await guest.call(
        "/auth/password/reset",
        "POST",
        { token: "x".repeat(43), password: newPassword },
        400,
      );
      assert.equal(invalid.message, "El enlace para cambiar la contraseña no es válido o caducó.");
    },
  );
  await suite(
    "Avisos a invitados: solo con el correo del organizador confirmado, agrupados y con baja en un clic",
    async () => {
      const owner = client(),
        data = account("avisos");
      const created = await owner.call("/auth/register", "POST", data, 201);
      users.push(created.id);
      assert.equal(created.emailVerified, false);
      const invitado = `qa-${unique}-invitado-avisos@example.invalid`;
      const evento = await owner.call("/events", "POST", eventPayload(), 201);
      await owner.call(`/events/${evento.id}/invitations`, "POST", {
        name: "Invitada", email: invitado, phone: "", notes: "", kind: "individual",
        members: [{ name: "Invitada", kind: "adult", notes: "" }],
      }, 201);
      // Sin confirmar el correo, un cambio no escribe al invitado
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ location: "Otro jardín" }));
      assert.equal((await mailsTo(invitado, /^Hay cambios en /)).length, 0);
      // El correo de confirmación llega con su enlace de un solo uso
      const mail = await mailTo(data.email, /^Confirma tu correo en TuEventoFun$/);
      const token = new URL(mail.Text.match(/https?:\/\/\S+\/confirmar-correo\?token=[\w-]{43}/)[0]).searchParams.get("token");
      assert.equal((await guest.call("/auth/email/verify", "POST", { token })).emailVerified, true);
      await guest.call("/auth/email/verify", "POST", { token }, 400);
      assert.equal((await owner.call("/auth/me")).emailVerified, true);
      // Confirmado: el primer cambio sale al momento, con baja en un clic
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ location: "Jardín nuevo" }));
      const [cambio] = await mailsTo(invitado, /^Hay cambios en /);
      assert.ok(cambio, "falta el aviso de cambios");
      const completo = await fetch(`${mailpit}/api/v1/message/${cambio.ID}`).then((r) => r.json());
      assert.match(completo.Text, /Jardín nuevo/);
      const oneClick = /<(https?:\/\/[^>]+)>/.exec(completo.ListUnsubscribe.Header)[1];
      assert.match(completo.ListUnsubscribe.HeaderPost, /List-Unsubscribe=One-Click/);
      // El siguiente cambio dentro de 30 minutos espera para ir en un solo aviso
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ location: "Jardín definitivo" }));
      assert.equal((await mailsTo(invitado, /^Hay cambios en /)).length, 1);
      // La cancelación sale al momento
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ location: "Jardín definitivo", cancelled: true }));
      assert.equal((await mailsTo(invitado, /^Cancelado: /)).length, 1);
      // Baja en un clic, como la hace un gestor de correo: formulario, sin cabecera propia ni Origin
      const url = new URL(oneClick);
      const baja = await send(`${base}/mail/unsubscribe${url.search}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      });
      assert.equal(baja.status, 200, baja.text);
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ location: "Jardín definitivo", cancelled: false }));
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ location: "Jardín definitivo", cancelled: true }));
      assert.equal((await mailsTo(invitado, /^Cancelado: /)).length, 1, "tras la baja no llegan más avisos");
    },
  );

  await suite("Cupos de correo: cada dirección recibe como mucho 5 avisos al día", async () => {
    const owner = client(),
      data = account("cupo");
    const created = await owner.call("/auth/register", "POST", data, 201);
    users.push(created.id);
    const mail = await mailTo(data.email, /^Confirma tu correo en TuEventoFun$/);
    const token = new URL(mail.Text.match(/https?:\/\/\S+\/confirmar-correo\?token=[\w-]{43}/)[0]).searchParams.get("token");
    await guest.call("/auth/email/verify", "POST", { token });
    const invitado = `qa-${unique}-invitado-cupo@example.invalid`;
    const evento = await owner.call("/events", "POST", eventPayload(), 201);
    await owner.call(`/events/${evento.id}/invitations`, "POST", {
      name: "Invitado", email: invitado, phone: "", notes: "", kind: "individual",
      members: [{ name: "Invitado", kind: "adult", notes: "" }],
    }, 201);
    for (let i = 0; i < 7; i++) {
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ cancelled: true }));
      await owner.call(`/events/${evento.id}`, "PATCH", eventPayload({ cancelled: false }));
    }
    assert.equal((await mailsTo(invitado, /^Cancelado: /)).length, 5);
  });

  await suite("Newsletter responde en el idioma del dominio", async () => {
    const en = await guest.call(
      "/newsletter/subscribe",
      "POST",
      { email: `qa-${unique}-news@example.invalid` },
      201,
      { Host: englishHost },
    );
    assert.equal(en.ok, true);
    assert.match(en.message, /^Thanks/);
    const es = await guest.call(
      "/newsletter/subscribe",
      "POST",
      { email: `qa-${unique}-noticias@example.invalid` },
      201,
    );
    assert.match(es.message, /^¡Gracias/);
  });
  await suite("Eliminar invitación y evento invalida enlaces", async () => {
    await a.call(`/events/${event.id}/invitations/${invitation.id}`, "DELETE");
    await guest.call(`/invitations/${invitation.token}`, "GET", undefined, 404);
    await a.call(`/events/${event.id}`, "DELETE");
    assert.deepEqual(await a.call("/events"), []);
  });
  mkdirSync("qa-artifacts", { recursive: true });
  writeFileSync(
    "qa-artifacts/api-results.json",
    JSON.stringify({ date: new Date().toISOString(), tests: records }, null, 2),
  );
  console.log(`${records.length} API checks passed`);
} finally {
  if (!process.env.TEST_API_URL && users.length) {
    assert.ok(users.every((id) => /^[a-f0-9-]{36}$/.test(id)));
    execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "tuevento",
        "-d",
        "tueventofun",
        "-c",
        `DELETE FROM users WHERE id IN (${users.map((id) => `'${id}'`).join(",")}) AND email LIKE 'qa-%@example.invalid'; DELETE FROM newsletter_subscribers WHERE email LIKE 'qa-${unique}-%@example.invalid';`,
      ],
      { stdio: "ignore" },
    );
  }
}
