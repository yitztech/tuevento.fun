import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { admin, baseTemporal } from "../support/db.js";

// El rol del panel (services/postgres/sql/admin-role.sql) solo lee lo que muestra el panel.
// Se aplica el mismo SQL sobre una base temporal y con un nombre de rol único, para no tocar
// el rol real `admin_ro` del servidor de desarrollo.
const sqlArchivo = fileURLToPath(new URL("../../../services/postgres/sql/admin-role.sql", import.meta.url));
const PASSWORD = "clave-de-prueba-admin";
const rol = `admin_ro_test_${randomBytes(3).toString("hex")}`;

let base, lector;
const conectar = (password) =>
  new pg.Pool({ host: process.env.TEST_DB_HOST || "127.0.0.1", port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 5487), user: rol, password, database: base.nombre, max: 1 });

// Psql no corre aquí: se sustituyen sus variables (:'admin_pw', :"db") y el nombre del rol
async function aplicar(password) {
  const sql = readFileSync(sqlArchivo, "utf8")
    .replaceAll(":'admin_pw'", `'${password}'`)
    .replaceAll(':"db"', `"${base.nombre}"`)
    .replaceAll("admin_ro", rol);
  const dueno = admin(base.nombre);
  try {
    await dueno.query(sql);
  } finally {
    await dueno.end();
  }
}

before(async () => {
  base = await baseTemporal();
  await aplicar(PASSWORD);
  lector = conectar(PASSWORD);
});
after(async () => {
  await lector?.end();
  await base?.cerrar();
  const limpieza = admin();
  await limpieza.query(`DROP ROLE IF EXISTS ${rol}`);
  await limpieza.end();
});

const PERMISO_DENEGADO = "42501";
const denegado = async (sql) => {
  await assert.rejects(lector.query(sql), (e) => e.code === PERMISO_DENEGADO, sql);
};

test("el panel lee lo que muestra: usuarios (sin contraseña), sesiones, actividad, eventos e invitaciones", async () => {
  await lector.query("SELECT id, first_name, last_name, email, registration_platform, created_at, is_demo FROM users");
  await lector.query("SELECT expires_at FROM sessions");
  await lector.query("SELECT kind, platform, visitor_id, route, created_at FROM activity");
  await lector.query("SELECT id, title, theme, archived, created_at FROM events");
  await lector.query("SELECT id, event_id FROM invitations");
  await lector.query("SELECT invitation_id, status FROM members");
});

test("el panel nunca ve contraseñas, tokens ni teléfonos", async () => {
  await denegado("SELECT password_hash FROM users");
  await denegado("SELECT phone FROM users");
  await denegado("SELECT token_hash FROM sessions");
  await denegado("SELECT user_id FROM sessions");
  await denegado("SELECT token_hash FROM password_resets");
  await denegado("SELECT code_hash FROM mobile_auth_codes");
});

test("el panel no escribe nada", async () => {
  await denegado("UPDATE users SET first_name = 'x'");
  await denegado("DELETE FROM events");
  await denegado("INSERT INTO activity(id, kind, platform) VALUES (gen_random_uuid(), 'visit', 'web')");
  await denegado("CREATE TABLE robado (x int)");
});

test("repetir el script con el rol ya creado y con permisos no falla: cambia la contraseña y deja los mismos permisos", async () => {
  const otra = "otra-clave-de-prueba-admin";
  const dueno = admin(base.nombre);
  // Un permiso que no está en la lista: al repetir el script debe desaparecer
  await dueno.query(`GRANT SELECT (phone) ON users TO ${rol}`);
  await dueno.end();

  await aplicar(otra);
  const nuevo = conectar(otra);
  try {
    await nuevo.query("SELECT id, email FROM users");
    await assert.rejects(nuevo.query("SELECT phone FROM users"), (e) => e.code === PERMISO_DENEGADO);
  } finally {
    await nuevo.end();
  }
  const viejo = conectar(PASSWORD);
  await assert.rejects(viejo.query("SELECT 1"), (e) => e.code === "28P01");
  await viejo.end();

  await aplicar(PASSWORD);
});
