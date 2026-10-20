// Pruebas de la base de datos (SOLO EN LOCAL, ver docs/TESTS.md): cada ejecución crea una base
// temporal en el PostgreSQL de `docker compose up`, aplica en ella todas las migraciones como el
// rol `api` (el de producción, sin privilegios de administrador) y la borra al terminar.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";

const raiz = fileURLToPath(new URL("../../../", import.meta.url));

/** Lee .env (si existe) sin dependencias: el compose de desarrollo usa sus contraseñas. */
function envLocal() {
  const archivo = join(raiz, ".env");
  const valores = {};
  if (existsSync(archivo))
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/);
      if (m) valores[m[1]] = m[2];
    }
  return valores;
}
const env = { ...envLocal(), ...process.env };
const host = env.TEST_DB_HOST || "127.0.0.1";
const port = Number(env.TEST_DB_PORT || env.DB_PORT || 5487);
const passwordAdmin = env.TEST_DB_ADMIN_PASSWORD || env.POSTGRES_PASSWORD || "dev-postgres";
const passwordApi = env.TEST_DB_API_PASSWORD || env.API_DB_PASSWORD || "dev-api";

export const migracionesDir = join(raiz, "apps/api/migrations");
export const migraciones = readdirSync(migracionesDir).filter((f) => f.endsWith(".sql")).sort();

/** Un pool sin listener de `error` lanza la excepción no capturada cuando el servidor cierra una conexión
 * ociosa (57P01, p. ej. al borrar la base con FORCE). Ese cierre es esperado al terminar; el resto se muestra. */
export function conectarPool(config) {
  const pool = new pg.Pool(config);
  pool.on("error", (error) => {
    if (error.code !== "57P01") console.error(`PostgreSQL (pool): ${error.message}`);
  });
  return pool;
}

const conexion = (user, password, database) => conectarPool({ host, port, user, password, database, max: 4 });

/** Pool como administrador (crear/borrar la base temporal y consultar roles). */
export const admin = (database = "postgres") => conexion("tuevento", passwordAdmin, database);

/** Crea la base temporal, aplica las migraciones como `api` y devuelve { api, nombre, cerrar }. */
export async function baseTemporal() {
  const nombre = `tuevento_test_${randomBytes(4).toString("hex")}`;
  const raizAdmin = admin();
  try {
    await raizAdmin.query(`CREATE DATABASE ${nombre}`);
  } catch (e) {
    await raizAdmin.end();
    throw new Error(`No se pudo conectar a PostgreSQL en ${host}:${port} (${e.message}). ¿Está arriba? docker compose up -d`);
  }
  const propia = admin(nombre);
  // Mismos permisos que da services/postgres/initdb/00-roles.sh en la base real
  await propia.query(`GRANT CONNECT ON DATABASE ${nombre} TO api`);
  await propia.query("GRANT USAGE, CREATE ON SCHEMA public TO api");
  await propia.end();

  const api = conexion("api", passwordApi, nombre);
  // Igual que apps/api/src/database.ts: una transacción por migración, registrada
  await api.query("CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const archivo of migraciones) {
    const c = await api.connect();
    try {
      await c.query("BEGIN");
      await c.query(readFileSync(join(migracionesDir, archivo), "utf8"));
      await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [archivo]);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw new Error(`La migración ${archivo} falló: ${e.message}`);
    } finally {
      c.release();
    }
  }
  return {
    api,
    nombre,
    async cerrar() {
      await api.end();
      await raizAdmin.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
      await raizAdmin.end();
    },
  };
}

/** Ejecuta `fn` y devuelve el código SQLSTATE del error (o null si no falló). */
export async function codigoError(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.code ?? `sin-codigo:${e.message}`;
  }
}

export const CHECK_VIOLATION = "23514";
export const UNIQUE_VIOLATION = "23505";
export const FK_VIOLATION = "23503";
export const NOT_NULL_VIOLATION = "23502";
export const PERMISO_DENEGADO = "42501";

let n = 0;
/** Usuario mínimo válido; `extra` sobrescribe columnas. Devuelve el id. */
export async function usuario(db, extra = {}) {
  const fila = {
    id: crypto.randomUUID(),
    first_name: "Ana",
    last_name: "Prueba",
    email: `u${Date.now()}-${n++}@example.invalid`,
    ...extra,
  };
  const columnas = Object.keys(fila);
  await db.query(
    `INSERT INTO users(${columnas.join(",")}) VALUES(${columnas.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(fila),
  );
  return fila.id;
}
