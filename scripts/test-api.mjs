import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.TEST_API_URL || "http://127.0.0.1:3087/api";
const records = [],
  users = [];
const suite = async (name, fn) => {
  await fn();
  records.push({ name, passed: true });
  console.log("PASS", name);
};
function client() {
  let cookie = "";
  return {
    async call(path, method = "GET", body, expected = 200, headers = {}) {
      const r = await fetch(base + path, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          "X-TuEvento-Client": "1",
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const data = await r.json();
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
  username: `qa_${unique}_${n}`,
  password,
});
try {
  await suite("Salud de API y PostgreSQL", async () =>
    assert.equal((await guest.call("/health")).status, "ok"),
  );
  await suite(
    "Sesión obligatoria para eventos y validación de registro",
    async () => {
      await guest.call("/events", "GET", undefined, 401);
      await guest.call("/auth/register", "POST", { email: "bad" }, 400);
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
        date: "2026-12-20T23:00:00Z",
        timeZone: "America/Mexico_City",
        location: "Jardín de pruebas",
        theme: "floral",
      };
      await a.call("/events", "POST", { ...data, date: "no-date" }, 400);
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
        400,
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
    "Idioma de API: validación, notificaciones y contenido original",
    async () => {
      const en = { "Accept-Language": "en-US" };
      const invalid = await guest.call(
        "/auth/login",
        "POST",
        { email: "bad", password: "" },
        400,
        en,
      );
      assert.equal(invalid.message, "Enter a valid email address.");
      const missing = await guest.call("/auth/register", "POST", {}, 400, en);
      assert.match(missing.message, /Invalid input/);
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
      const original = await a.call(
        `/events/${event.id}`,
        "GET",
        undefined,
        200,
        en,
      );
      assert.equal(original.title, "QA · Celebración");
      const response = await fetch(base + "/health", { headers: en });
      assert.equal(response.headers.get("content-language"), "en");
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
      const payload = {
        ...invitation,
        members: [
          { ...invitation.members[0], name: "Ana Actualizada" },
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
          members: [{ ...other.members[0] }],
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
        400,
      );
      const u = await a.call("/profile", "PATCH", {
        firstName: "Organizador",
        lastName: "Pruebas",
        phone: "+527770000000",
        username: account(1).username,
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
        `DELETE FROM users WHERE id IN (${users.map((id) => `'${id}'`).join(",")}) AND email LIKE 'qa-%@example.invalid';`,
      ],
      { stdio: "ignore" },
    );
  }
}
