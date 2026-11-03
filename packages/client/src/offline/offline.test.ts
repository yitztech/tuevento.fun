// Trabajo sin conexión (fase 8b): cola en orden, reintentos, conflictos, idempotencia, borrado al
// perder la sesión, descarga de cambios y lecturas con la copia local. Sin DOM ni Capacitor.
import test from "node:test";
import assert from "node:assert/strict";
import type { Event, EventInput, Invitation, InvitationInput } from "@tuevento/contracts";
import { FakeServer } from "./fake-server";
import {
  MemoryStore,
  OfflineEventApi,
  Outbox,
  SyncEngine,
  importRecordKey,
  newRecordKey,
  openRecord,
  retryDelays,
  sealRecord,
  uuidv7,
} from "./index";

const eventInput = (extra: Partial<EventInput> = {}): EventInput => ({
  title: "Boda sin red",
  description: "",
  date: "2027-12-20T23:00:00.000Z",
  timeZone: "America/Mexico_City",
  location: "Jardín",
  theme: "floral",
  archived: false,
  cancelled: false,
  slug: "",
  ...extra,
});
const invitationInput = (extra: Partial<InvitationInput> = {}): InvitationInput => ({
  name: "Familia López",
  email: "",
  phone: "",
  notes: "",
  kind: "family",
  members: [{ name: "Ana López", kind: "adult", notes: "" }],
  ...extra,
});

/** Temporizadores falsos: se ve qué espera se programó y se dispara a mano. */
function fakeTimers() {
  const scheduled: { fn: () => void; ms: number }[] = [];
  return {
    scheduled,
    timers: {
      setTimeout: (fn: () => void, ms: number) => {
        scheduled.push({ fn, ms });
        return scheduled.length - 1;
      },
      clearTimeout: () => {},
    },
  };
}

function setup({ online = true, timeoutMs = 50 } = {}) {
  const server = new FakeServer();
  const store = new MemoryStore();
  const clock = fakeTimers();
  const net = { online };
  const lost: number[] = [];
  const apiOptions = { baseUrl: "https://tuevento.test/api", platform: "android" as const, fetch: ((input, init) => server.fetch(input, init)) as typeof fetch };
  const plain = new OfflineEventApi(apiOptions, { store, engine: null as unknown as SyncEngine, online: () => net.online, timeoutMs });
  const engine = new SyncEngine({ api: plain, store, timers: clock.timers, onAuthLost: () => lost.push(1) });
  const api = new OfflineEventApi(apiOptions, { store, engine, online: () => net.online, timeoutMs });
  return { server, store, clock, net, lost, engine, api };
}

test("uuidv7: versión 7, variante RFC y ordenados por fecha", () => {
  const a = uuidv7(1_700_000_000_000);
  const b = uuidv7(1_700_000_000_001);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(a < b);
  assert.notEqual(uuidv7(1), uuidv7(1));
});

test("Outbox: guarda en orden de llegada, quita por condición y devuelve a la cola", async () => {
  const outbox = new Outbox(new MemoryStore());
  const first = await outbox.enqueue({ method: "POST", path: "/events", body: {}, entity: { kind: "event", id: "e1" } });
  await outbox.enqueue({ method: "POST", path: "/events/e1/invitations", body: {}, entity: { kind: "invitation", id: "i1", eventId: "e1" } });
  await outbox.enqueue({ method: "POST", path: "/events", body: {}, entity: { kind: "event", id: "e2" } });
  assert.deepEqual((await outbox.all()).map((o) => o.order), [1, 2, 3]);
  assert.match(first.idempotencyKey, /^[0-9a-f-]{36}$/);
  await outbox.removeWhere((o) => o.entity.kind === "invitation");
  assert.deepEqual((await outbox.pending()).map((o) => ("id" in o.entity ? o.entity.id : "")), ["e1", "e2"]);
  await outbox.update({ ...first, state: "conflict", error: "x", currentVersion: 3 });
  assert.equal((await outbox.pending()).length, 1);
  await outbox.retry(first.id, 3);
  const back = (await outbox.all())[0];
  assert.deepEqual([back.state, back.baseVersion, back.error, back.currentVersion], ["pending", 3, undefined, undefined]);
});

test("Cifrado: cada registro se abre solo con su clave, su colección y su id", async () => {
  const { key, exported } = await newRecordKey();
  const sealed = await sealRecord(key, "events", "e1", { title: "Privado" });
  assert.ok(!sealed.data.includes("Privado"));
  const again = await importRecordKey(exported);
  assert.deepEqual(await openRecord(again, "events", "e1", sealed), { title: "Privado" });
  await assert.rejects(openRecord(again, "events", "e2", sealed), "movido a otro id");
  await assert.rejects(openRecord(again, "invitations", "e1", sealed), "movido a otra colección");
  const tampered = { ...sealed, data: sealed.data.slice(0, -4) + (sealed.data.endsWith("AAAA") ? "BBBB" : "AAAA") };
  await assert.rejects(openRecord(again, "events", "e1", tampered), "alterado");
  await assert.rejects(openRecord((await newRecordKey()).key, "events", "e1", sealed), "otra clave");
  const other = await sealRecord(key, "events", "e1", { title: "Privado" });
  assert.notEqual(other.iv, sealed.iv, "un iv nuevo en cada escritura");
});

test("Sin red: crear un evento y su invitación los guarda en la copia y la cola los envía en orden", async () => {
  const { server, store, net, api, engine } = setup({ online: false });
  server.mode = "down";
  const event = await api.saveEvent(eventInput());
  const invitation = await api.saveInvitation(event.id, invitationInput());
  assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  assert.equal((await api.events())[0].id, event.id, "se lee de la copia local");
  assert.equal((await api.event(event.id)).metrics.invitations, 1, "métricas recalculadas en el teléfono");
  assert.equal((await api.invitations(event.id))[0].members[0].id.startsWith("local-"), true);
  assert.equal((await engine.outbox.pending()).length, 2);

  net.online = true;
  server.mode = "up";
  const result = await engine.run();
  assert.equal(result.sent, 2);
  assert.deepEqual(server.log.filter((r) => r.method !== "GET").map((r) => `${r.method} ${r.path}`), [
    "POST /events",
    `POST /events/${event.id}/invitations`,
  ]);
  const [create, invite] = server.log.filter((r) => r.method === "POST");
  assert.equal((create.body as { id: string }).id, event.id, "el id del teléfono viaja al servidor");
  assert.ok(create.headers["idempotency-key"]);
  assert.equal((invite.body as { members: { id?: string }[] }).members[0].id, undefined, "las personas locales van sin id");
  assert.equal((await engine.outbox.all()).length, 0);
  const synced = await store.get<Invitation>("invitations", invitation.id);
  assert.ok(synced?.token.startsWith("t-"), "la copia guarda lo que devolvió el servidor (con su enlace)");
  assert.equal(server.events.size, 1);
});

test("Error de red: la cola queda igual y se reintenta con espera exponencial de 2 s a 5 min", async () => {
  const { server, net, api, engine, clock } = setup({ online: false });
  server.mode = "down";
  await api.saveEvent(eventInput());
  net.online = true;
  const delays: number[] = [];
  for (let i = 0; i < 10; i++) {
    const result = await engine.run();
    assert.equal(result.stopped, "network");
    delays.push(clock.scheduled.at(-1)!.ms);
  }
  assert.deepEqual(delays, [2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, retryDelays.max, retryDelays.max]);
  assert.equal(engine.status.state, "waiting");
  const [op] = await engine.outbox.pending();
  assert.equal(op.attempts, 10);
  assert.equal(op.state, "pending");
  // Vuelve la red: el reintento programado envía la cola y la espera vuelve a empezar
  server.mode = "up";
  clock.scheduled.at(-1)!.fn();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await engine.outbox.all()).length, 0);
  assert.equal(engine.consecutiveFailures, 0);
  assert.equal(server.events.size, 1);
});

test("Conflicto: si el evento cambió en otro dispositivo, la edición queda en conflicto con la versión actual y lo demás sigue", async () => {
  const { server, net, api, engine } = setup();
  const event = await api.saveEvent(eventInput());
  const other = await api.saveEvent(eventInput({ title: "Otro" }));
  server.editElsewhere(event.id, "Cambiado en la tableta");
  net.online = false;
  server.mode = "down";
  await api.saveEvent(eventInput({ title: "Cambiado en el teléfono" }), event.id);
  await api.saveEvent(eventInput({ title: "Otro, editado" }), other.id);
  net.online = true;
  server.mode = "up";
  await engine.run();
  const [conflict] = await engine.outbox.all();
  assert.equal(conflict.state, "conflict");
  assert.equal(conflict.currentVersion, 2);
  assert.equal(conflict.error, "Esto cambió en otro dispositivo.");
  assert.equal(conflict.baseVersion, 1);
  assert.equal(server.events.get(other.id)?.title, "Otro, editado", "la operación siguiente se envió");
  assert.equal(server.events.get(event.id)?.title, "Cambiado en la tableta", "no se pisó el cambio ajeno");
  assert.deepEqual([engine.status.conflicts, engine.status.pending], [1, 0]);
});

test("Validación: un 4xx deja la operación como fallida con el mensaje traducido", async () => {
  const { server, net, api, engine } = setup({ online: false });
  server.mode = "down";
  await api.saveEvent(eventInput({ title: "" }));
  net.online = true;
  server.mode = "up";
  await engine.run();
  const [failed] = await engine.outbox.all();
  assert.deepEqual([failed.state, failed.error], ["failed", "Escribe el nombre del evento."]);
  assert.equal(engine.status.failed, 1);
});

test("Idempotencia: si la red se corta después de que el servidor guardó, el reintento no duplica", async () => {
  const { server, api, engine } = setup({ timeoutMs: 30 });
  // El servidor guarda pero la respuesta no llega a tiempo
  const realFetch = server.fetch;
  server.fetch = async (input, init) => {
    const response = await realFetch(input, init);
    if ((init?.method ?? "GET") !== "GET") await new Promise((r) => setTimeout(r, 80));
    return response;
  };
  const event = await api.saveEvent(eventInput());
  assert.equal(server.events.size, 1, "el servidor ya lo guardó");
  // El teléfono lo puso en la cola y el motor lo reenvía (con la misma clave)
  await engine.run();
  server.fetch = realFetch;
  await engine.run();
  assert.equal((await engine.outbox.all()).length, 0);
  const posts = server.log.filter((r) => r.method === "POST");
  assert.equal(posts.length, 2);
  assert.equal(posts[0].headers["idempotency-key"], posts[1].headers["idempotency-key"], "misma clave en el reintento");
  assert.equal(server.events.size, 1, "sin duplicado");
  assert.equal((await api.events())[0].id, event.id);
});

test("Dos ediciones sin red del mismo evento: la segunda se envía con la versión que dejó la primera", async () => {
  const { server, net, api, engine } = setup();
  const event = await api.saveEvent(eventInput());
  net.online = false;
  server.mode = "down";
  await api.saveEvent(eventInput({ title: "Uno" }), event.id);
  await api.saveEvent(eventInput({ title: "Dos" }), event.id);
  net.online = true;
  server.mode = "up";
  await engine.run();
  assert.equal((await engine.outbox.all()).length, 0);
  const patches = server.log.filter((r) => r.method === "PATCH");
  assert.deepEqual(patches.map((p) => p.headers["if-match"]), ['"1"', '"2"']);
  assert.equal(server.events.get(event.id)?.title, "Dos");
});

test("Borrar un evento creado sin red y aún no enviado lo olvida sin llamar al servidor", async () => {
  const { server, net, api, engine } = setup({ online: false });
  server.mode = "down";
  const event = await api.saveEvent(eventInput());
  await api.saveInvitation(event.id, invitationInput());
  await api.deleteEvent(event.id);
  assert.deepEqual(await engine.outbox.all(), []);
  assert.deepEqual(await api.events(), []);
  net.online = true;
  server.mode = "up";
  await engine.run();
  assert.equal(server.log.filter((r) => r.method !== "GET").length, 0);
});

test("401: se borra toda la copia (cola incluida), se avisa a la app y no se reintenta", async () => {
  const { server, store, net, api, engine, lost, clock } = setup({ online: false });
  server.mode = "down";
  await api.saveEvent(eventInput());
  net.online = true;
  server.mode = "up";
  server.forced.push(new Response(JSON.stringify({ status: 401, code: "unauthorized", message: "Inicia sesión" }), { status: 401 }));
  const result = await engine.run();
  assert.equal(result.stopped, "auth");
  assert.deepEqual(lost, [1]);
  assert.deepEqual(await store.list("events"), []);
  assert.deepEqual(await store.list("outbox"), []);
  assert.equal(engine.status.state, "signed-out");
  assert.equal(clock.scheduled.length, 0);
});

test("Descarga: aplica cambios, borra en cascada lo borrado, guarda el cursor y con 410 lo vuelve a bajar todo", async () => {
  const { server, store, api, engine } = setup();
  const event = await api.saveEvent(eventInput());
  const invitation = await api.saveInvitation(event.id, invitationInput());
  const store2 = new MemoryStore();
  const phone = new SyncEngine({ api, store: store2, pageLimit: 1 });
  await phone.run();
  assert.equal((await store2.list("events")).length, 1, "por páginas de uno, sin perder nada");
  assert.equal((await store2.list("invitations")).length, 1);
  const cursor = await store2.get<string>("meta", "sync-cursor");
  assert.ok(cursor);

  // Responde un invitado: llegan la invitación y el aviso, y las métricas se recalculan
  server.guestReplies(invitation.id);
  await phone.run();
  const local = await store2.get<Event>("events", event.id);
  assert.equal(local?.metrics.accepted, 1);
  assert.equal((await store2.list("notifications")).length, 1);

  // Otro dispositivo borra el evento: se va con su invitación y su aviso
  server.deleteElsewhere(event.id);
  await phone.run();
  assert.deepEqual(await store2.list("events"), []);
  assert.deepEqual(await store2.list("invitations"), []);
  assert.deepEqual(await store2.list("notifications"), []);

  // Purga de tombstones: el cursor anterior caduca (410) y lo baja todo otra vez, por páginas de
  // uno, sin volver a caducar a mitad, y lo que ya no existe desaparece
  const again = await api.saveEvent(eventInput({ title: "Nuevo" }));
  const otro = await api.saveEvent(eventInput({ title: "Otro nuevo" }));
  server.deleteElsewhere(otro.id);
  await store2.set("events", "fantasma", { id: "fantasma" });
  await new Promise((r) => setTimeout(r, 5));
  server.purge();
  await new Promise((r) => setTimeout(r, 5));
  const result = await phone.run();
  assert.equal(result.pulled, true);
  assert.deepEqual((await store2.list<Event>("events")).map((e) => e.id), [again.id]);
  void store;
  void engine;
});

test("La descarga no pisa un dato con escrituras aún en la cola", async () => {
  const { server, store, net, api, engine } = setup();
  const event = await api.saveEvent(eventInput());
  await engine.run();
  net.online = false;
  server.mode = "down";
  await api.saveEvent(eventInput({ title: "Mío, sin enviar" }), event.id);
  server.mode = "up";
  server.editElsewhere(event.id, "Del servidor");
  // Solo descarga (la cola sigue sin poder enviarse: el envío falla con conflicto)
  await engine.run();
  assert.equal((await store.get<Event>("events", event.id))?.title, "Mío, sin enviar");
  assert.equal((await engine.outbox.all())[0].state, "conflict");
});

test("Lecturas: con red, del servidor (y se guardan); sin red o sin respuesta en el tiempo, de la copia local", async () => {
  const { server, store, net, api } = setup({ timeoutMs: 30 });
  const event = await api.saveEvent(eventInput());
  server.editElsewhere(event.id, "Del servidor");
  assert.equal((await api.events())[0].title, "Del servidor");
  assert.equal((await store.get<Event>("events", event.id))?.title, "Del servidor");
  server.editElsewhere(event.id, "Otra vez");
  server.mode = "hang";
  assert.equal((await api.event(event.id)).title, "Del servidor", "8 s (aquí 30 ms) sin respuesta: la copia");
  net.online = false;
  assert.equal((await api.events()).length, 1);
  await assert.rejects(api.event("no-existe"), /couldntFindEvent/);
  // Un 4xx con red no se tapa con la copia local
  net.online = true;
  server.mode = "up";
  await assert.rejects(api.event(crypto.randomUUID()), /No encontramos el evento/);
});

test("Avisos: marcarlos como leídos sin red se aplica a la copia y se envía después", async () => {
  const { server, store, net, api, engine } = setup();
  const event = await api.saveEvent(eventInput());
  const invitation = await api.saveInvitation(event.id, invitationInput());
  server.guestReplies(invitation.id);
  await engine.run();
  net.online = false;
  server.mode = "down";
  await api.readNotifications();
  assert.ok((await api.notifications()).every((n) => n.read));
  net.online = true;
  server.mode = "up";
  await engine.run();
  assert.ok([...server.notifications.values()].every((n) => n.read));
  void store;
});
