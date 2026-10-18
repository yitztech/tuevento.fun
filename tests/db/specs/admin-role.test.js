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
before(async () => {
  base = await baseTemporal();
  // Psql no corre aquí: se sustituyen sus variables (:'admin_pw', :"db") y el nombre del rol
  const sql = readFileSync(sqlArchivo, "utf8")
    .replaceAll(":'admin_pw'", `'${PASSWORD}'`)
    .replaceAll(':"db"', `"${base.nombre}"`)
    .replaceAll("admin_ro", rol);
  const dueno = admin(base.nombre);
  await dueno.query(sql);
  await dueno.end();
  lector = new pg.Pool({ host: process.env.TEST_DB_HOST || "127.0.0.1", port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 5487), user: rol, password: PASSWORD, database: base.nombre, max: 1 });
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
