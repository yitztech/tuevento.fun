import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { admin, baseTemporal, codigoError, conectarPool, migraciones, PERMISO_DENEGADO, usuario } from "../support/db.js";

// Búsqueda de proveedores (migración 022 y services/postgres/sql/search-bootstrap.sql): la tabla
// provider_search se mantiene sola con triggers y el rol del servicio `search` solo la lee a ella.
// El bootstrap se aplica sobre una base temporal con un nombre de rol único, sin tocar `search_ro`.
const sqlArchivo = fileURLToPath(new URL("../../../services/postgres/sql/search-bootstrap.sql", import.meta.url));
const PASSWORD = "clave-de-prueba-search";
const rol = `search_ro_test_${randomBytes(3).toString("hex")}`;

let base, db, lector;
const uno = async (sql, params) => (await db.query(sql, params)).rows[0];
const fila = (id) => uno("SELECT * FROM provider_search WHERE provider_id=$1", [id]);

// Psql no corre aquí: se sustituyen sus variables (:'search_pw', :"db") y el nombre del rol
async function bootstrap() {
  const sql = readFileSync(sqlArchivo, "utf8")
    .replaceAll(":'search_pw'", `'${PASSWORD}'`)
    .replaceAll(':"db"', `"${base.nombre}"`)
    .replaceAll("search_ro", rol);
  const dueno = admin(base.nombre);
  try {
    await dueno.query(sql);
  } finally {
    await dueno.end();
  }
}

before(async () => {
  base = await baseTemporal();
  db = base.api;
  await bootstrap();
  lector = conectarPool({
    host: process.env.TEST_DB_HOST || "127.0.0.1",
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 5487),
    user: rol,
    password: PASSWORD,
    database: base.nombre,
    max: 1,
  });
});
after(async () => {
  await lector?.end();
  await base?.cerrar();
  const limpieza = admin();
  await limpieza.query(`DROP ROLE IF EXISTS ${rol}`);
  await limpieza.end();
});

async function perfil(extra = "") {
  const dueno = await usuario(db);
  return uno(
    `INSERT INTO provider_profiles(id,user_id,slug,business_name,headline,city,latitude,longitude${extra ? "," : ""}${extra})
     VALUES(gen_random_uuid(),$1,'p-'||md5(random()::text),'Salón Lúna','Bodas y XV años','Cuernavaca',18.92345,-99.23456${extra ? ",'exact'" : ""})
     RETURNING id`,
    [dueno],
  );
}
const publicar = (id) => db.query("UPDATE provider_profiles SET status='published', published_at=now() WHERE id=$1", [id]);

test("Búsqueda: solo los perfiles publicados tienen fila, y se va al dejar de estarlo", async () => {
  const p = await perfil();
  assert.equal(await fila(p.id), undefined, "un borrador no aparece");
  await publicar(p.id);
  const f = await fila(p.id);
  assert.equal(f.business_name, "Salón Lúna");
  assert.equal(f.name_norm, "salon luna", "sin acentos y en minúsculas");
  await db.query("UPDATE provider_profiles SET status='suspended' WHERE id=$1", [p.id]);
  assert.equal(await fila(p.id), undefined, "un perfil suspendido no aparece");
});

test("Búsqueda: con la dirección aproximada el punto se redondea; con la exacta, no", async () => {
  const aprox = await perfil();
  await publicar(aprox.id);
  assert.deepEqual([(await fila(aprox.id)).latitude, (await fila(aprox.id)).longitude], [18.92, -99.23]);
  const exacta = await perfil("address_visibility");
  await publicar(exacta.id);
  assert.deepEqual([(await fila(exacta.id)).latitude, (await fila(exacta.id)).longitude], [18.92345, -99.23456]);
});

test("Búsqueda: categorías, servicios, precio y portada se actualizan en la misma transacción", async () => {
  const p = await perfil();
  await publicar(p.id);
  await db.query("INSERT INTO provider_categories(provider_id,category) VALUES($1,'venue'),($1,'catering')", [p.id]);
  assert.deepEqual((await fila(p.id)).categories, ["catering", "venue"]);
  await db.query(
    "INSERT INTO provider_services(id,provider_id,title,price_from_cents,currency,price_unit) VALUES(gen_random_uuid(),$1,'Banquete',90000,'MXN','person'),(gen_random_uuid(),$1,'Terraza jardín',50000,'MXN','event')",
    [p.id],
  );
  let f = await fila(p.id);
  assert.equal(Number(f.price_from_cents), 50000, "el precio «desde» más bajo");
  assert.equal(f.currency, "MXN");
  const busca = async (texto) =>
    (await uno("SELECT count(*)::int AS n FROM provider_search WHERE provider_id=$1 AND document @@ websearch_to_tsquery('simple', f_unaccent($2))", [p.id, texto])).n;
  assert.equal(await busca("jardin"), 1, "el título del servicio, sin acento");
  assert.equal(await busca("cuernavaca"), 1, "la ciudad");
  const foto = await uno("INSERT INTO provider_images(id,provider_id,width,height) VALUES(gen_random_uuid(),$1,10,10) RETURNING id", [p.id]);
  assert.equal((await fila(p.id)).cover_image_id, foto.id, "sin portada elegida, la primera foto");
  await db.query("DELETE FROM provider_categories WHERE provider_id=$1 AND category='venue'", [p.id]);
  f = await fila(p.id);
  assert.deepEqual(f.categories, ["catering"]);
  await db.query("DELETE FROM users WHERE id=(SELECT user_id FROM provider_profiles WHERE id=$1)", [p.id]);
  assert.equal(await fila(p.id), undefined, "borrar la cuenta borra su fila");
});

test("Búsqueda: un perfil publicado sin fecha de publicación no rompe la escritura", async () => {
  const p = await perfil();
  await db.query("UPDATE provider_profiles SET status='published' WHERE id=$1", [p.id]);
  assert.ok((await fila(p.id)).published_at);
});

test("Búsqueda: la migración 022 indexa los perfiles que ya estaban publicados", async () => {
  const anterior = await baseTemporal({ hasta: "022_provider_search.sql" });
  try {
    const dueno = await usuario(anterior.api);
    const { rows } = await anterior.api.query(
      "INSERT INTO provider_profiles(id,user_id,slug,business_name,status,published_at) VALUES(gen_random_uuid(),$1,'ya-publicado','Ya publicado','published',now()) RETURNING id",
      [dueno],
    );
    await anterior.aplicarResto();
    const n = (await anterior.api.query("SELECT count(*)::int AS n FROM provider_search WHERE provider_id=$1", [rows[0].id])).rows[0].n;
    assert.equal(n, 1);
  } finally {
    await anterior.cerrar();
  }
  assert.ok(migraciones.includes("022_provider_search.sql"));
});

test("El rol de la búsqueda solo lee provider_search: ni cuentas, ni perfiles, ni escribir", async () => {
  await lector.query("SELECT slug, business_name, categories, document FROM provider_search");
  for (const tabla of ["users", "sessions", "provider_profiles", "provider_services", "password_resets", "events"])
    assert.equal(await codigoError(() => lector.query(`SELECT 1 FROM ${tabla} LIMIT 1`)), PERMISO_DENEGADO, tabla);
  assert.equal(await codigoError(() => lector.query("DELETE FROM provider_search")), PERMISO_DENEGADO);
  assert.equal(await codigoError(() => lector.query("CREATE TABLE x(id int)")), PERMISO_DENEGADO);
  const { rows } = await lector.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname=current_user");
  assert.deepEqual(Object.values(rows[0]), [false, false, false, false, false]);
});

test("El bootstrap de la búsqueda se puede repetir sin errores", async () => {
  await bootstrap();
  await lector.query("SELECT count(*) FROM provider_search");
});
