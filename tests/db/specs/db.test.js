import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { accountLimits, supportedLocales, themeIds } from "@tuevento/contracts";
import {
  admin, baseTemporal, codigoError, usuario, migraciones,
  CHECK_VIOLATION, UNIQUE_VIOLATION, FK_VIOLATION, NOT_NULL_VIOLATION, PERMISO_DENEGADO,
} from "../support/db.js";

let base, db;
before(async () => {
  base = await baseTemporal();
  db = base.api;
});
after(async () => base?.cerrar());

const uno = async (sql, params) => (await db.query(sql, params)).rows[0];
const columnas = async (tabla) =>
  (await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [tabla])).rows.map((r) => r.column_name);

test("Las migraciones se aplican en orden desde una base vacía, como el rol api", async () => {
  const aplicadas = (await db.query("SELECT name FROM schema_migrations ORDER BY name")).rows.map((r) => r.name);
  assert.deepEqual(aplicadas, migraciones);
  const tablas = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")).rows.map((r) => r.tablename);
  assert.deepEqual(tablas, ["activity", "app_releases", "events", "invitations", "members", "mobile_auth_codes", "newsletter_subscribers", "notifications", "password_resets", "postcard_images", "postcard_versions", "postcards", "schema_migrations", "sessions", "users"]);
});

test("El correo electrónico es el identificador: users no tiene nombre de usuario", async () => {
  const cols = await columnas("users");
  assert.ok(!cols.includes("username"));
  assert.ok(cols.includes("email"));
});

test("Ni contraseñas ni tokens se guardan en claro: solo hashes", async () => {
  for (const [tabla, hash] of [["users", "password_hash"], ["sessions", "token_hash"], ["password_resets", "token_hash"], ["mobile_auth_codes", "code_hash"]]) {
    const cols = await columnas(tabla);
    assert.ok(cols.includes(hash), `${tabla}.${hash}`);
    assert.ok(!cols.includes("password") && !cols.includes("token") && !cols.includes("code"), `${tabla} guarda un secreto en claro`);
  }
});

test("Los límites de longitud de la base de datos coinciden con accountLimits", async () => {
  const limites = [["first_name", accountLimits.personName], ["last_name", accountLimits.personName], ["email", accountLimits.email], ["phone", accountLimits.phone]];
  for (const [columna, max] of limites) {
    const def = (await db.query("SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname=$1", [`users_${columna}_max_length`])).rows[0]?.d;
    assert.match(def ?? "", new RegExp(`char_length\\(${columna}\\) <= ${max}\\)`), `users_${columna}_max_length`);
    // En el límite se acepta; uno más se rechaza (y con el correo, que además conserva forma de correo)
    const valor = (n) => (columna === "email" ? `${"a".repeat(n - 12)}@example.com` : columna === "phone" ? "1".repeat(n) : "a".repeat(n));
    const extra = (n) => ({ [columna]: valor(n), ...(columna === "email" ? {} : { email: `lim-${columna}-${n}@example.invalid` }) });
    assert.equal(await codigoError(() => usuario(db, extra(max))), null, `${columna} = ${max}`);
    assert.equal(await codigoError(() => usuario(db, extra(max + 1))), CHECK_VIOLATION, `${columna} = ${max + 1}`);
  }
});

test("Nombre, apellidos y correo son obligatorios", async () => {
  for (const columna of ["first_name", "last_name", "email"])
    assert.equal(await codigoError(() => usuario(db, { [columna]: null })), NOT_NULL_VIOLATION, columna);
});

test("El correo es único", async () => {
  const email = `unico-${Date.now()}@example.invalid`;
  await usuario(db, { email });
  assert.equal(await codigoError(() => usuario(db, { email })), UNIQUE_VIOLATION);
});

test("Idiomas soportados (es, en, pt, de, fr): la base de datos los acepta y rechaza códigos inválidos", async () => {
  assert.deepEqual([...supportedLocales].sort(), ["de", "en", "es", "fr", "pt"]);
  for (const locale of supportedLocales) {
    const id = await usuario(db, { locale });
    assert.equal((await uno("SELECT locale FROM users WHERE id=$1", [id])).locale, locale);
    // El mismo código vale para los correos de recuperación y la newsletter
    await db.query("INSERT INTO password_resets(token_hash, user_id, locale, expires_at) VALUES($1,$2,$3, now() + interval '1 hour')", [`h-${locale}-${id}`, id, locale]);
  }
  for (const malo of ["EN", "e", "esp1", "es-MX", "", " es", "español"]) {
    assert.equal(await codigoError(() => usuario(db, { locale: malo })), CHECK_VIOLATION, `users.locale = ${JSON.stringify(malo)}`);
  }
  assert.equal((await uno("SELECT locale FROM users WHERE id=$1", [await usuario(db)])).locale, "es", "el idioma por defecto es es");
});

test("Valores permitidos: tema, tipo y estado solo admiten los definidos", async () => {
  const dueno = await usuario(db);
  const evento = async (theme) => db.query("INSERT INTO events(id,user_id,title,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E', now(),'UTC','L',$2)", [dueno, theme]);
  for (const bueno of themeIds) assert.equal(await codigoError(() => evento(bueno)), null, bueno);
  assert.equal(await codigoError(() => evento("inexistente")), CHECK_VIOLATION);

  const e = await uno("INSERT INTO events(id,user_id,title,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E',now(),'UTC','L','gold') RETURNING id", [dueno]);
  const invitacion = async (kind) => db.query("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I',$2,$3)", [e.id, kind, crypto.randomUUID().replaceAll("-", "")]);
  assert.equal(await codigoError(() => invitacion("individual")), null);
  assert.equal(await codigoError(() => invitacion("family")), null);
  assert.equal(await codigoError(() => invitacion("grupo")), CHECK_VIOLATION);

  const inv = await uno("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I','family',$2) RETURNING id", [e.id, crypto.randomUUID().replaceAll("-", "")]);
  const miembro = async (kind, status) => db.query("INSERT INTO members(id,invitation_id,name,kind,status) VALUES(gen_random_uuid(),$1,'M',$2,$3)", [inv.id, kind, status]);
  for (const kind of ["adult", "child"]) for (const status of ["accepted", "declined", "pending"]) assert.equal(await codigoError(() => miembro(kind, status)), null);
  assert.equal(await codigoError(() => miembro("adult", "quizas")), CHECK_VIOLATION);
  assert.equal(await codigoError(() => miembro("bebe", "pending")), CHECK_VIOLATION);

  const actividad = async (kind, platform) => db.query("INSERT INTO activity(id,kind,platform) VALUES(gen_random_uuid(),$1,$2)", [kind, platform]);
  for (const kind of ["visit", "registration", "login", "download"]) for (const platform of ["web", "android", "ios"]) assert.equal(await codigoError(() => actividad(kind, platform)), null);
  assert.equal(await codigoError(() => actividad("clic", "web")), CHECK_VIOLATION);
  assert.equal(await codigoError(() => actividad("visit", "windows")), CHECK_VIOLATION);
});

test("Integridad referencial: no hay filas huérfanas", async () => {
  const sinDueno = crypto.randomUUID();
  assert.equal(await codigoError(() => db.query("INSERT INTO events(id,user_id,title,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E',now(),'UTC','L','gold')", [sinDueno])), FK_VIOLATION);
  assert.equal(await codigoError(() => db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('x',$1, now())", [sinDueno])), FK_VIOLATION);
  assert.equal(await codigoError(() => db.query("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I','family','t')", [crypto.randomUUID()])), FK_VIOLATION);
});

test("Borrar un evento borra sus invitaciones, miembros y notificaciones", async () => {
  const dueno = await usuario(db);
  const e = await uno("INSERT INTO events(id,user_id,title,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E',now(),'UTC','L','gold') RETURNING id", [dueno]);
  const inv = await uno("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I','family',$2) RETURNING id", [e.id, crypto.randomUUID().replaceAll("-", "")]);
  await db.query("INSERT INTO members(id,invitation_id,name,kind) VALUES(gen_random_uuid(),$1,'M','adult')", [inv.id]);
  await db.query("INSERT INTO notifications(id,user_id,event_id,guest_name,message) VALUES(gen_random_uuid(),$1,$2,'G','m')", [dueno, e.id]);
  await db.query("DELETE FROM events WHERE id=$1", [e.id]);
  for (const [tabla, col, valor] of [["invitations", "event_id", e.id], ["members", "invitation_id", inv.id], ["notifications", "event_id", e.id]])
    assert.equal((await uno(`SELECT count(*)::int n FROM ${tabla} WHERE ${col}=$1`, [valor])).n, 0, tabla);
  assert.equal((await uno("SELECT count(*)::int n FROM users WHERE id=$1", [dueno])).n, 1, "la cuenta sigue");
});

test("Borrar una cuenta borra todo lo suyo, salvo la actividad anónima que se conserva sin usuario", async () => {
  const id = await usuario(db);
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2, now() + interval '1 day')", [`s-${id}`, id]);
  await db.query("INSERT INTO password_resets(token_hash,user_id,locale,expires_at) VALUES($1,$2,'es', now() + interval '1 hour')", [`p-${id}`, id]);
  await db.query("INSERT INTO mobile_auth_codes(code_hash,challenge,user_id,expires_at) VALUES($1,'c',$2, now() + interval '1 minute')", [`m-${id}`, id]);
  const e = await uno("INSERT INTO events(id,user_id,title,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E',now(),'UTC','L','gold') RETURNING id", [id]);
  const act = await uno("INSERT INTO activity(id,kind,platform,user_id) VALUES(gen_random_uuid(),'registration','web',$1) RETURNING id", [id]);
  await db.query("DELETE FROM users WHERE id=$1", [id]);
  for (const [tabla, col] of [["sessions", "user_id"], ["password_resets", "user_id"], ["mobile_auth_codes", "user_id"], ["events", "user_id"]])
    assert.equal((await uno(`SELECT count(*)::int n FROM ${tabla} WHERE ${col}=$1`, [id])).n, 0, tabla);
  assert.equal((await uno("SELECT count(*)::int n FROM events WHERE id=$1", [e.id])).n, 0);
  const fila = await uno("SELECT user_id FROM activity WHERE id=$1", [act.id]);
  assert.equal(fila.user_id, null, "la métrica se conserva sin dato personal");
});

test("El rol api no tiene privilegios de administrador (en el servidor real)", async () => {
  const raiz = admin();
  try {
    const rol = (await raiz.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='api'")).rows[0];
    assert.deepEqual(rol, { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolcanlogin: true });
  } finally {
    await raiz.end();
  }
  // Y en la práctica: no puede crear roles ni bases, ni leer las credenciales del servidor
  assert.equal(await codigoError(() => db.query("CREATE ROLE intruso LOGIN")), PERMISO_DENEGADO);
  assert.equal(await codigoError(() => db.query("CREATE DATABASE intruso")), PERMISO_DENEGADO);
  assert.equal(await codigoError(() => db.query("SELECT rolpassword FROM pg_authid")), PERMISO_DENEGADO);
  assert.equal(await codigoError(() => db.query("COPY users TO PROGRAM 'id'")), PERMISO_DENEGADO);
});

test("Postal: el diseño tiene tamaño acotado y se borra con su evento", async () => {
  const dueno = await usuario(db);
  const e = await uno("INSERT INTO events(id,user_id,title,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E',now(),'UTC','L','gold') RETURNING id", [dueno]);
  await db.query("INSERT INTO postcards(event_id) VALUES($1)", [e.id]);
  assert.equal(await codigoError(() => db.query("UPDATE postcards SET design=$2 WHERE event_id=$1", [e.id, JSON.stringify({ texto: "x".repeat(20000) })])), CHECK_VIOLATION);
  await db.query("DELETE FROM events WHERE id=$1", [e.id]);
  assert.equal((await uno("SELECT count(*)::int AS n FROM postcards WHERE event_id=$1", [e.id])).n, 0);
});
