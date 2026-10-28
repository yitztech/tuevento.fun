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
  assert.deepEqual(tablas, ["activity", "app_releases", "event_access", "events", "geo_cache", "invitations", "members", "mobile_auth_codes", "newsletter_subscribers", "notifications", "password_resets", "postcard_images", "postcard_versions", "postcards", "provider_categories", "provider_deleted_slugs", "provider_images", "provider_profiles", "provider_search", "provider_services", "provider_slug_history", "schema_migrations", "sessions", "trusted_devices", "users"]);
});

test("El correo electrónico es el identificador: users no tiene nombre de usuario", async () => {
  const cols = await columnas("users");
  assert.ok(!cols.includes("username"));
  assert.ok(cols.includes("email"));
});

test("Ni contraseñas ni tokens se guardan en claro: solo hashes", async () => {
  for (const [tabla, hash] of [["users", "password_hash"], ["sessions", "token_hash"], ["password_resets", "token_hash"], ["mobile_auth_codes", "code_hash"], ["trusted_devices", "token_hash"]]) {
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
  const evento = async (theme) => db.query("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text), now(),'UTC','L',$2)", [dueno, theme]);
  for (const bueno of themeIds) assert.equal(await codigoError(() => evento(bueno)), null, bueno);
  assert.equal(await codigoError(() => evento("inexistente")), CHECK_VIOLATION);

  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [dueno]);
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
  assert.equal(await codigoError(() => db.query("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold')", [sinDueno])), FK_VIOLATION);
  assert.equal(await codigoError(() => db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('x',$1, now())", [sinDueno])), FK_VIOLATION);
  assert.equal(await codigoError(() => db.query("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'I','family','t')", [crypto.randomUUID()])), FK_VIOLATION);
});

test("Borrar un evento borra sus invitaciones, miembros y notificaciones", async () => {
  const dueno = await usuario(db);
  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [dueno]);
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
  await db.query("INSERT INTO trusted_devices(token_hash,user_id,expires_at) VALUES($1,$2, now() + interval '180 days')", [`d-${id}`, id]);
  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [id]);
  const act = await uno("INSERT INTO activity(id,kind,platform,user_id) VALUES(gen_random_uuid(),'registration','web',$1) RETURNING id", [id]);
  await db.query("DELETE FROM users WHERE id=$1", [id]);
  for (const [tabla, col] of [["sessions", "user_id"], ["password_resets", "user_id"], ["mobile_auth_codes", "user_id"], ["trusted_devices", "user_id"], ["events", "user_id"]])
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
  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [dueno]);
  await db.query("INSERT INTO postcards(event_id) VALUES($1)", [e.id]);
  assert.equal(await codigoError(() => db.query("UPDATE postcards SET design=$2 WHERE event_id=$1", [e.id, JSON.stringify({ texto: "x".repeat(20000) })])), CHECK_VIOLATION);
  await db.query("DELETE FROM events WHERE id=$1", [e.id]);
  assert.equal((await uno("SELECT count(*)::int AS n FROM postcards WHERE event_id=$1", [e.id])).n, 0);
});

test("Dirección del evento: obligatoria, con formato y longitud, y única dentro de cada cuenta", async () => {
  const [a, b] = [await usuario(db), await usuario(db)];
  const evento = (dueno, slug) => uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E',$2,now(),'UTC','L','gold') RETURNING id", [dueno, slug]);
  const e1 = await evento(a, "boda-ana-2026");
  assert.equal(await codigoError(() => evento(a, null)), CHECK_VIOLATION, "sin dirección no hay landing");
  assert.equal(await codigoError(() => db.query("UPDATE events SET slug='Boda Ana' WHERE id=$1", [e1.id])), CHECK_VIOLATION);
  assert.equal(await codigoError(() => db.query("UPDATE events SET slug='ab' WHERE id=$1", [e1.id])), CHECK_VIOLATION);
  assert.equal(await codigoError(() => db.query("UPDATE events SET slug=$2 WHERE id=$1", [e1.id, "a".repeat(accountLimits.eventSlug + 1)])), CHECK_VIOLATION);
  assert.equal(await codigoError(() => db.query("UPDATE events SET slug=NULL WHERE id=$1", [e1.id])), CHECK_VIOLATION);
  // La misma dirección no se repite en una cuenta, pero otra cuenta sí puede usarla: la URL lleva su código
  assert.equal(await codigoError(() => evento(a, "boda-ana-2026")), UNIQUE_VIOLATION);
  await evento(b, "boda-ana-2026");
});

test("Código público de la cuenta: se genera solo, con 8 caracteres, y es único", async () => {
  const [a, b] = [await usuario(db), await usuario(db)];
  const codigo = async (id) => (await uno("SELECT public_code FROM users WHERE id=$1", [id])).public_code;
  assert.match(await codigo(a), /^[a-z0-9]{8}$/);
  assert.notEqual(await codigo(a), await codigo(b));
  const deA = await codigo(a);
  assert.equal(await codigoError(() => db.query("UPDATE users SET public_code=$2 WHERE id=$1", [b, deA])), UNIQUE_VIOLATION);
  for (const malo of [null, "ABCDEFGH", "abc", "abcdefghi", "abcd-fgh"])
    assert.equal(await codigoError(() => db.query("UPDATE users SET public_code=$2 WHERE id=$1", [b, malo])), CHECK_VIOLATION, `public_code = ${JSON.stringify(malo)}`);
});

test("La 015 da código a las cuentas y dirección a los eventos que ya existían", async () => {
  const vieja = await baseTemporal({ hasta: "015_landing_evento.sql" });
  try {
    const q = (sql, params) => vieja.api.query(sql, params);
    const dueno = await usuario(vieja.api);
    const otro = await usuario(vieja.api);
    const evento = (user, title, slug = null) =>
      q("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,$2,$3,now(),'UTC','L','gold') RETURNING id", [user, title, slug]).then((r) => r.rows[0].id);
    const conDireccion = await evento(dueno, "Mi fiesta", "fiesta-del-ano");
    const boda1 = await evento(dueno, "¡Boda de Ana & Luis!");
    const boda2 = await evento(dueno, "Boda de Ana y Luis");
    const choca = await evento(dueno, "Fiesta del año");
    const corta = await evento(otro, "!!");
    const deOtro = await evento(otro, "Boda de Ana y Luis");
    await vieja.aplicarResto();
    const slug = async (id) => (await q("SELECT slug FROM events WHERE id=$1", [id])).rows[0].slug;
    assert.equal(await slug(conDireccion), "fiesta-del-ano", "la que ya tenía no cambia");
    assert.equal(await slug(boda1), "boda-de-ana-luis");
    assert.equal(await slug(boda2), "boda-de-ana-y-luis");
    assert.match(await slug(choca), /^fiesta-del-ano-[0-9a-f]{6}$/, "si ya la usa otro evento de la cuenta, con sufijo");
    assert.equal(await slug(corta), "evento", "sin letras del título, «evento»");
    assert.equal(await slug(deOtro), "boda-de-ana-y-luis", "otra cuenta puede repetirla");
    const codigos = (await q("SELECT public_code FROM users WHERE id=ANY($1::uuid[])", [[dueno, otro]])).rows.map((r) => r.public_code);
    assert.equal(codigos.length, 2);
    for (const c of codigos) assert.match(c, /^[a-z0-9]{8}$/);
  } finally {
    await vieja.cerrar();
  }
});

test("Invitación genérica y avisos: tipos válidos, registros enlazados al enlace y acceso protegido", async () => {
  const dueno = await usuario(db);
  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [dueno]);
  assert.equal((await uno("SELECT cancelled FROM events WHERE id=$1", [e.id])).cancelled, false);
  const abierta = await uno("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'Abierta','open',gen_random_uuid()::text) RETURNING id", [e.id]);
  const hijo = await uno("INSERT INTO invitations(id,event_id,name,kind,token,parent_id) VALUES(gen_random_uuid(),$1,'Hijo','individual',gen_random_uuid()::text,$2) RETURNING id", [e.id, abierta.id]);
  assert.equal(await codigoError(() => db.query("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'X','otro',gen_random_uuid()::text)", [e.id])), CHECK_VIOLATION);
  // Al borrar el enlace, sus registros siguen existiendo como invitaciones normales
  await db.query("DELETE FROM invitations WHERE id=$1", [abierta.id]);
  assert.equal((await uno("SELECT parent_id FROM invitations WHERE id=$1", [hijo.id])).parent_id, null);
  // Acceso de un invitado a la landing: se borra con su invitación
  const personal = await uno("INSERT INTO invitations(id,event_id,name,kind,token) VALUES(gen_random_uuid(),$1,'Ana','individual',gen_random_uuid()::text) RETURNING id", [e.id]);
  await db.query("INSERT INTO event_access(token_hash,event_id,invitation_id,expires_at) VALUES($1,$2,$3,now()+interval '1 day')", ["hash-de-invitado", e.id, personal.id]);
  await db.query("DELETE FROM invitations WHERE id=$1", [personal.id]);
  assert.equal((await uno("SELECT count(*)::int AS n FROM event_access WHERE token_hash='hash-de-invitado'")).n, 0);
  assert.equal(await codigoError(() => db.query("INSERT INTO event_access(token_hash,event_id,invitation_id,expires_at) VALUES($1,$2,gen_random_uuid(),now())", ["hash-huerfano", e.id])), FK_VIOLATION);
  // Acceso a la página protegida: con caducidad, y se borra con su evento
  await db.query("INSERT INTO event_access(token_hash,event_id,expires_at) VALUES($1,$2,now()+interval '1 day')", ["hash-de-prueba", e.id]);
  await db.query("DELETE FROM events WHERE id=$1", [e.id]);
  assert.equal((await uno("SELECT count(*)::int AS n FROM event_access WHERE event_id=$1", [e.id])).n, 0);
});

test("Invitaciones: el enlace se busca por su hash, único, y se guarda cifrado (024)", async () => {
  const cols = await columnas("invitations");
  assert.ok(cols.includes("token_hash") && cols.includes("token_sealed"));
  const dueno = await usuario(db);
  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold') RETURNING id", [dueno]);
  const fila = "INSERT INTO invitations(id,event_id,name,kind,token,token_hash,token_sealed) VALUES(gen_random_uuid(),$1,'A','individual',gen_random_uuid()::text,$2,'cifrado')";
  await db.query(fila, [e.id, `h-${e.id}`]);
  assert.equal(await codigoError(() => db.query(fila, [e.id, `h-${e.id}`])), UNIQUE_VIOLATION);
});

test("Ubicación del evento: las dos coordenadas o ninguna, dentro de su rango; la caché del mapa solo admite sus tipos", async () => {
  const dueno = await usuario(db);
  const e = await uno("INSERT INTO events(id,user_id,title,slug,date,time_zone,location,theme,latitude,longitude) VALUES(gen_random_uuid(),$1,'E','e-'||md5(random()::text),now(),'UTC','L','gold',18.921831,-99.234567) RETURNING id, latitude, longitude", [dueno]);
  assert.deepEqual([e.latitude, e.longitude], [18.921831, -99.234567]);
  await db.query("UPDATE events SET latitude=NULL, longitude=NULL WHERE id=$1", [e.id]);
  for (const [lat, lng] of [[18.9, null], [null, -99.2], [90.0001, 0], [-90.0001, 0], [0, 180.0001], [0, -180.0001]])
    assert.equal(await codigoError(() => db.query("UPDATE events SET latitude=$2, longitude=$3 WHERE id=$1", [e.id, lat, lng])), CHECK_VIOLATION, `${lat},${lng}`);
  const validada = await uno("SELECT convalidated FROM pg_constraint WHERE conname='events_geo_range'");
  assert.equal(validada.convalidated, true, "la 018 valida la restricción");
  await db.query("INSERT INTO geo_cache(kind,key_hash,locale,response) VALUES('search',md5(random()::text),'es','[]')");
  assert.equal(await codigoError(() => db.query("INSERT INTO geo_cache(kind,key_hash,locale,response) VALUES('otro','x','es','[]')")), CHECK_VIOLATION);
});

test("Tipo de cuenta: organiza por defecto y solo admite organizer o provider", async () => {
  const id = await usuario(db);
  assert.equal((await uno("SELECT account_type FROM users WHERE id=$1", [id])).account_type, "organizer");
  await db.query("UPDATE users SET account_type='provider' WHERE id=$1", [id]);
  for (const valor of ["admin", "Provider", ""])
    assert.equal(await codigoError(() => db.query("UPDATE users SET account_type=$2 WHERE id=$1", [id, valor])), CHECK_VIOLATION, valor);
  assert.equal(await codigoError(() => db.query("UPDATE users SET account_type=NULL WHERE id=$1", [id])), NOT_NULL_VIOLATION);
  assert.equal((await uno("SELECT convalidated FROM pg_constraint WHERE conname='users_account_type_check'")).convalidated, true, "la 020 valida la restricción");
});

test("Proveedor: restricciones del perfil, los servicios y las fotos", async () => {
  const dueno = await usuario(db);
  const p = await uno("INSERT INTO provider_profiles(id,user_id,slug,business_name) VALUES(gen_random_uuid(),$1,'p-'||md5(random()::text),'Negocio') RETURNING id, updated_at", [dueno]);
  const cambio = (sql, params = []) => codigoError(() => db.query(sql, [p.id, ...params]));
  for (const [col, valor] of [["status", "borrado"], ["address_visibility", "secreta"], ["country", "mex"], ["slug", "Con Espacios"], ["slug", "ab"]])
    assert.equal(await cambio(`UPDATE provider_profiles SET ${col}=$2 WHERE id=$1`, [valor]), CHECK_VIOLATION, `${col}=${valor}`);
  assert.equal(await cambio("UPDATE provider_profiles SET service_radius_km=501 WHERE id=$1"), CHECK_VIOLATION);
  assert.equal(await cambio("UPDATE provider_profiles SET latitude=18.9 WHERE id=$1"), CHECK_VIOLATION, "una coordenada sin la otra");
  assert.equal(await cambio("UPDATE provider_profiles SET business_name=$2 WHERE id=$1", ["x".repeat(accountLimits.businessName + 1)]), CHECK_VIOLATION);
  assert.equal(await cambio("INSERT INTO provider_categories(provider_id,category) VALUES($1,'pirotecnia')"), CHECK_VIOLATION);
  await db.query("INSERT INTO provider_categories(provider_id,category) VALUES($1,'catering')", [p.id]);
  assert.equal(await cambio("INSERT INTO provider_categories(provider_id,category) VALUES($1,'catering')"), UNIQUE_VIOLATION);
  // Precio, moneda y unidad van juntos; los centavos no son negativos
  const servicio = "INSERT INTO provider_services(id,provider_id,title,price_from_cents,currency,price_unit) VALUES(gen_random_uuid(),$1,'S',$2,$3,$4)";
  for (const precio of [[100, null, null], [null, "MXN", null], [100, "MXN", null], [-1, "MXN", "event"], [100, "mxn", "event"], [100, "MXN", "semana"]])
    assert.equal(await cambio(servicio, precio), CHECK_VIOLATION, JSON.stringify(precio));
  await db.query(servicio, [p.id, 150000, "MXN", "event"]);
  await db.query(servicio, [p.id, null, null, null]);
  assert.equal(await cambio("INSERT INTO provider_images(id,provider_id,width,height) VALUES(gen_random_uuid(),$1,0,10)"), CHECK_VIOLATION);
  // updated_at lo pone la base de datos en cada cambio
  await db.query("SELECT pg_sleep(0.01)");
  await db.query("UPDATE provider_profiles SET headline='Nueva' WHERE id=$1", [p.id]);
  const despues = await uno("SELECT updated_at FROM provider_profiles WHERE id=$1", [p.id]);
  assert.ok(despues.updated_at > p.updated_at);
  // La dirección es única entre todos los negocios, y cada cuenta tiene un solo perfil
  const { slug } = await uno("SELECT slug FROM provider_profiles WHERE id=$1", [p.id]);
  assert.equal(await codigoError(() => db.query("INSERT INTO provider_profiles(id,user_id,slug,business_name) VALUES(gen_random_uuid(),$1,$2,'Otro')", [dueno, `${slug}-x`])), UNIQUE_VIOLATION);
});

test("Proveedor: borrar la cuenta borra perfil, servicios y fotos, y sus direcciones quedan como borradas", async () => {
  const dueno = await usuario(db);
  const slug = `negocio-${Date.now()}`;
  const p = await uno("INSERT INTO provider_profiles(id,user_id,slug,business_name) VALUES(gen_random_uuid(),$1,$2,'Negocio') RETURNING id", [dueno, slug]);
  const s = await uno("INSERT INTO provider_services(id,provider_id,title) VALUES(gen_random_uuid(),$1,'S') RETURNING id", [p.id]);
  const foto = await uno("INSERT INTO provider_images(id,provider_id,service_id,width,height) VALUES(gen_random_uuid(),$1,$2,10,10) RETURNING id", [p.id, s.id]);
  await db.query("UPDATE provider_profiles SET cover_image_id=$2 WHERE id=$1", [p.id, foto.id]);
  await db.query("INSERT INTO provider_slug_history(slug,provider_id) VALUES($1,$2)", [`${slug}-antes`, p.id]);
  // Borrar un servicio deja la foto sin servicio; borrar la foto deja el perfil sin portada
  await db.query("DELETE FROM provider_services WHERE id=$1", [s.id]);
  assert.equal((await uno("SELECT service_id FROM provider_images WHERE id=$1", [foto.id])).service_id, null);
  await db.query("DELETE FROM provider_images WHERE id=$1", [foto.id]);
  assert.equal((await uno("SELECT cover_image_id FROM provider_profiles WHERE id=$1", [p.id])).cover_image_id, null);
  await db.query("INSERT INTO provider_images(id,provider_id,width,height) VALUES(gen_random_uuid(),$1,10,10)", [p.id]);
  await db.query("DELETE FROM users WHERE id=$1", [dueno]);
  for (const tabla of ["provider_profiles", "provider_services", "provider_images", "provider_categories", "provider_slug_history"]) {
    const columna = tabla === "provider_profiles" ? "id" : "provider_id";
    assert.equal((await uno(`SELECT count(*)::int AS n FROM ${tabla} WHERE ${columna}=$1`, [p.id])).n, 0, tabla);
  }
  const borradas = (await db.query("SELECT slug FROM provider_deleted_slugs WHERE slug = ANY($1) ORDER BY slug", [[slug, `${slug}-antes`]])).rows.map((r) => r.slug);
  assert.deepEqual(borradas, [slug, `${slug}-antes`].sort());
});
