// Sincronización sin conexión (migración 028): reloj de cambios por cuenta, versiones, tombstones
// (también en cascada) e idempotency_keys.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { baseTemporal, codigoError, usuario, CHECK_VIOLATION, FK_VIOLATION } from "../support/db.js";

let base, db;
before(async () => {
  base = await baseTemporal();
  db = base.api;
});
after(async () => base?.cerrar());

const uno = async (sql, params) => (await db.query(sql, params)).rows[0];
const evento = (dueno) =>
  uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id, version, sync_seq", [dueno]);
const invitacion = (eventId) =>
  uno("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I','family',md5(random()::text)) RETURNING id, version, sync_seq", [eventId]);
const persona = (invitationId) =>
  uno("INSERT INTO members(id,invitation_id,name,kind) VALUES(gen_random_uuid(),$1,'P','adult') RETURNING id, version", [invitationId]);
const reloj = async (dueno) => Number((await uno("SELECT seq FROM sync_clock WHERE user_id=$1", [dueno])).seq);
const tombstones = async (dueno) =>
  (await db.query("SELECT entity, entity_id, seq FROM sync_tombstones WHERE user_id=$1 ORDER BY seq", [dueno])).rows;

test("Cada alta y cambio de una cuenta toma el siguiente número de su reloj; cada cuenta tiene el suyo", async () => {
  const ana = await usuario(db);
  const beto = await usuario(db);
  const e = await evento(ana);
  assert.equal(Number(e.sync_seq), 1);
  const i = await invitacion(e.id);
  assert.equal(Number(i.sync_seq), 2);
  const otro = await evento(beto);
  assert.equal(Number(otro.sync_seq), 1, "el reloj es por cuenta");
  await db.query("UPDATE events SET title='Otro' WHERE id=$1", [e.id]);
  assert.equal(Number((await uno("SELECT sync_seq FROM events WHERE id=$1", [e.id])).sync_seq), 3);
  assert.equal(await reloj(ana), 3);
});

test("La versión sube con lo que edita el organizador, no con los intentos fallidos de la contraseña pública", async () => {
  const dueno = await usuario(db);
  const e = await evento(dueno);
  assert.equal(Number(e.version), 1);
  await db.query("SELECT pg_sleep(0.01)");
  await db.query("UPDATE events SET location='Otro lugar' WHERE id=$1", [e.id]);
  const cambiado = await uno("SELECT version, updated_at, created_at, sync_seq FROM events WHERE id=$1", [e.id]);
  assert.equal(Number(cambiado.version), 2);
  assert.ok(cambiado.updated_at > cambiado.created_at);
  await db.query("UPDATE events SET public_password_failures=public_password_failures+1 WHERE id=$1", [e.id]);
  const intento = await uno("SELECT version, sync_seq FROM events WHERE id=$1", [e.id]);
  assert.equal(Number(intento.version), 2, "un intento fallido no es un conflicto");
  assert.ok(Number(intento.sync_seq) > Number(cambiado.sync_seq), "pero sí se sincroniza");
});

test("Una persona que cambia toca su invitación (número nuevo) sin subir la versión de la invitación", async () => {
  const dueno = await usuario(db);
  const e = await evento(dueno);
  const i = await invitacion(e.id);
  const p = await persona(i.id);
  const tras = await uno("SELECT version, sync_seq FROM invitations WHERE id=$1", [i.id]);
  assert.equal(Number(tras.version), 1);
  assert.ok(Number(tras.sync_seq) > Number(i.sync_seq));
  await db.query("UPDATE members SET status='accepted' WHERE id=$1", [p.id]);
  assert.equal(Number((await uno("SELECT version FROM members WHERE id=$1", [p.id])).version), 2);
  const respondida = await uno("SELECT version, sync_seq FROM invitations WHERE id=$1", [i.id]);
  assert.equal(Number(respondida.version), 1, "la respuesta de un invitado no provoca conflicto al organizador");
  assert.ok(Number(respondida.sync_seq) > Number(tras.sync_seq));
  await db.query("DELETE FROM members WHERE id=$1", [p.id]);
  assert.ok(Number((await uno("SELECT sync_seq FROM invitations WHERE id=$1", [i.id])).sync_seq) > Number(respondida.sync_seq));
  await db.query("UPDATE invitations SET notes='Nota' WHERE id=$1", [i.id]);
  assert.equal(Number((await uno("SELECT version FROM invitations WHERE id=$1", [i.id])).version), 2);
});

test("Borrar deja tombstones: una invitación sola, y un evento con sus invitaciones y avisos en cascada", async () => {
  const dueno = await usuario(db);
  const e = await evento(dueno);
  const suelta = await invitacion(e.id);
  await db.query("DELETE FROM invitations WHERE id=$1", [suelta.id]);
  assert.deepEqual((await tombstones(dueno)).map((t) => [t.entity, t.entity_id]), [["invitation", suelta.id]]);

  const i = await invitacion(e.id);
  await persona(i.id);
  const aviso = await uno("INSERT INTO notifications(id,user_id,event_id,guest_name,message) VALUES(gen_random_uuid(),$1,$2,'G','M') RETURNING id", [dueno, e.id]);
  await db.query("DELETE FROM events WHERE id=$1", [e.id]);
  const borrados = (await tombstones(dueno)).map((t) => `${t.entity}:${t.entity_id}`);
  assert.deepEqual(borrados.sort(), [`event:${e.id}`, `invitation:${i.id}`, `invitation:${suelta.id}`, `notification:${aviso.id}`].sort());
  const seqs = (await tombstones(dueno)).map((t) => Number(t.seq));
  assert.equal(new Set(seqs).size, seqs.length, "cada tombstone tiene su propio número");
  assert.ok(Math.min(...seqs) > 0);
});

test("Perfil de proveedor: servicios, fotos y categorías lo tocan; borrar la cuenta lo borra todo, tombstones incluidos", async () => {
  const dueno = await usuario(db);
  const p = await uno("INSERT INTO provider_profiles(id,user_id,slug,business_name) VALUES(gen_random_uuid(),$1,'p-'||md5(random()::text),'Negocio') RETURNING id, version, sync_seq", [dueno]);
  const s = await uno("INSERT INTO provider_services(id,provider_id,title) VALUES(gen_random_uuid(),$1,'S') RETURNING id, version", [p.id]);
  const tocado = await uno("SELECT version, sync_seq FROM provider_profiles WHERE id=$1", [p.id]);
  assert.equal(Number(tocado.version), 1);
  assert.ok(Number(tocado.sync_seq) > Number(p.sync_seq));
  await db.query("UPDATE provider_services SET title='Otro' WHERE id=$1", [s.id]);
  assert.equal(Number((await uno("SELECT version FROM provider_services WHERE id=$1", [s.id])).version), 2);
  await db.query("INSERT INTO provider_categories(provider_id,category) VALUES($1,'dj')", [p.id]);
  await db.query("INSERT INTO provider_images(id,provider_id,width,height) VALUES(gen_random_uuid(),$1,10,10)", [p.id]);
  await db.query("UPDATE provider_profiles SET headline='Nuevo' WHERE id=$1", [p.id]);
  assert.equal(Number((await uno("SELECT version FROM provider_profiles WHERE id=$1", [p.id])).version), 2);

  // Una cuenta de organizador con datos también se borra entera, sin tombstones huérfanos
  const e = await evento(dueno);
  await persona((await invitacion(e.id)).id);
  await db.query("DELETE FROM users WHERE id=$1", [dueno]);
  for (const tabla of ["sync_clock", "sync_tombstones", "events", "provider_profiles"])
    assert.equal(Number((await uno(`SELECT count(*) AS n FROM ${tabla} WHERE user_id=$1`, [dueno])).n), 0, tabla);
});

test("idempotency_keys: una clave por cuenta, con método y estado acotados, y se borra con la cuenta", async () => {
  const dueno = await usuario(db);
  const clave = crypto.randomUUID();
  const fila = "INSERT INTO idempotency_keys(user_id,key,method,path,body_hash,status) VALUES($1,$2,'POST','/api/events','h',$3)";
  await db.query(fila, [dueno, clave, 201]);
  assert.equal(await codigoError(() => db.query(fila, [dueno, clave, 201])), "23505", "la misma clave dos veces en la misma cuenta");
  await db.query(fila, [await usuario(db), clave, 201]);
  assert.equal(await codigoError(() => db.query(fila, [dueno, crypto.randomUUID(), 99])), CHECK_VIOLATION);
  assert.equal(await codigoError(() => db.query(fila, [crypto.randomUUID(), crypto.randomUUID(), 200])), FK_VIOLATION);
  await db.query("DELETE FROM users WHERE id=$1", [dueno]);
  assert.equal(Number((await uno("SELECT count(*) AS n FROM idempotency_keys WHERE user_id=$1", [dueno])).n), 0);
});

test("La 028 numera los datos que ya existían, sin empates dentro de cada cuenta", async () => {
  const vieja = await baseTemporal({ hasta: "028_sincronizacion.sql" });
  try {
    const q = (sql, p) => vieja.api.query(sql, p);
    const dueno = await usuario(vieja.api);
    const ids = [];
    for (let n = 0; n < 3; n++) {
      const { rows: [e] } = await q("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [dueno]);
      ids.push(e.id);
      await q("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I','family',md5(random()::text))", [e.id]);
    }
    await vieja.aplicarResto();
    const { rows } = await q(
      "SELECT sync_seq FROM events WHERE user_id=$1 UNION ALL SELECT i.sync_seq FROM invitations i JOIN events e ON e.id=i.event_id WHERE e.user_id=$1",
      [dueno],
    );
    const seqs = rows.map((r) => Number(r.sync_seq));
    assert.equal(seqs.length, 6);
    assert.equal(new Set(seqs).size, 6);
    assert.ok(seqs.every((s) => s > 0));
    const { rows: [c] } = await q("SELECT seq FROM sync_clock WHERE user_id=$1", [dueno]);
    assert.ok(Number(c.seq) >= Math.max(...seqs), "el reloj sigue después de lo ya numerado");
    const { rows: [nuevo] } = await q("UPDATE events SET title='X' WHERE id=$1 RETURNING sync_seq, version", [ids[0]]);
    assert.ok(Number(nuevo.sync_seq) > Math.max(...seqs));
    assert.equal(Number(nuevo.version), 2);
  } finally {
    await vieja.cerrar();
  }
});
