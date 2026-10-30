// Datos de ejemplo del entorno local «demo» (compose.demo.yml): 20 organizadores y 20 proveedores
// creados por la API real (mismas validaciones, hashes y restricciones que en uso normal).
//   · Organizadores: 5 sin eventos, 5 con 1 a 3, 5 con 10 y 5 con 11 a 15.
//   · Proveedores: 20 perfiles publicados, con servicios y fotos.
// Solo para local: nunca se ejecuta contra producción. Se puede repetir: si una cuenta ya
// existe, la salta (para empezar de cero: scripts/local-env.sh borrar demo).
import { deflateSync } from "node:zlib";
import http from "node:http";

const api = new URL(process.env.SEED_API_URL || "http://api:3087/api");
const mailpit = process.env.SEED_MAILPIT_URL || "http://mailpit:8025";
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10) throw new Error("DEMO_PASSWORD (10 caracteres o más) es obligatoria");

// El idioma de la API sale del Host (dominio) y de X-App-Locale (prefijo /pt, /de, /fr del dominio en inglés)
const hosts = {
  es: { host: process.env.SEED_HOST_ES || "tuevento.localhost" },
  en: { host: process.env.SEED_HOST_EN || "yourevent.localhost" },
};
for (const l of ["pt", "de", "fr"]) hosts[l] = { host: hosts.en.host, appLocale: l };

/** Cliente con su cookie de sesión, como un navegador. */
function client(locale = "es") {
  const jar = new Map();
  const { host, appLocale } = hosts[locale];
  return {
    request(path, { method = "GET", body, expected = [200, 201, 204] } = {}) {
      return new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const req = http.request(
          `${api.origin}${api.pathname}${path}`,
          {
            method,
            headers: {
              Host: host,
              "X-TuEvento-Client": "1",
              ...(appLocale ? { "X-App-Locale": appLocale } : {}),
              ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
              ...(jar.size ? { Cookie: [...jar.values()].join("; ") } : {}),
            },
          },
          (res) => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (c) => (text += c));
            res.on("end", () => {
              for (const line of res.headers["set-cookie"] ?? []) {
                const pair = line.split(";")[0];
                const key = pair.split("=")[0];
                // Una cookie vacía o caducada es la forma de borrarla
                if (pair.endsWith("=") || /max-age=0\b/i.test(line)) jar.delete(key);
                else jar.set(key, pair);
              }
              let data = {};
              try { data = JSON.parse(text || "{}"); } catch { data = { _text: text }; }
              if (!expected.includes(res.statusCode))
                return reject(new Error(`${method} ${path} → ${res.statusCode} ${text.slice(0, 300)}`));
              resolve({ status: res.statusCode, data });
            });
          },
        );
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
      });
    },
  };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

/** Borra los correos viejos de una dirección (de un sembrado anterior): solo vale el que llegue ahora. */
const clearMail = (address) =>
  fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`, { method: "DELETE" });

/** Confirma el correo con el enlace que la API manda a Mailpit. */
async function verifyEmail(c, address) {
  for (let i = 0; i < 60; i++) {
    const list = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`).then((r) => r.json());
    for (const m of list.messages ?? []) {
      const msg = await fetch(`${mailpit}/api/v1/message/${m.ID}`).then((r) => r.json());
      const token = msg.Text?.match(/\/confirmar-correo\?token=([\w-]{43})/)?.[1];
      if (token) return c.request("/auth/email/verify", { method: "POST", body: { token } });
    }
    await pause(250);
  }
  throw new Error(`No llegó el correo de confirmación a ${address}`);
}

// ── Personas ────────────────────────────────────────────────────────────────────────────────
const firstNames = ["Sofía", "Mateo", "Valentina", "Santiago", "Camila", "Sebastián", "Isabella", "Emiliano", "Regina", "Leonardo",
  "Ximena", "Daniel", "Renata", "Diego", "Fernanda", "Andrés", "Paula", "Gael", "Mariana", "Joaquín",
  "Lucía", "Héctor", "Abril", "Rodrigo", "Elena", "Iván", "Natalia", "Tomás", "Jimena", "Bruno"];
const lastNames = ["García", "Hernández", "López", "Martínez", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Flores",
  "Torres", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Gutiérrez", "Ortiz", "Mendoza",
  "Castillo", "Vargas", "Romero", "Herrera", "Medina", "Aguilar", "Silva", "Ríos", "Navarro", "Salazar"];
const person = (i) => ({ firstName: firstNames[i % firstNames.length], lastName: lastNames[(i * 7 + 3) % lastNames.length] });
const phoneFor = (i) => `+52 777 ${200 + ((i * 37) % 700)} ${String(1000 + ((i * 7919) % 9000))}`;

// ── Organizadores ───────────────────────────────────────────────────────────────────────────
// Eventos por organizador: 5 sin eventos, 5 con al menos 1, 5 con 10 y 5 con más de 10
const eventCounts = [0, 0, 0, 0, 0, 1, 2, 3, 1, 2, 10, 10, 10, 10, 10, 11, 12, 13, 14, 15];
const organizerLocales = ["es", "es", "en", "es", "pt", "es", "de", "en", "es", "fr"];

const venues = [
  { place: "Jardín Las Bugambilias, Cuernavaca", lat: 18.9186, lng: -99.2342 },
  { place: "Terraza del Lago, Chapultepec, Ciudad de México", lat: 19.4204, lng: -99.1819 },
  { place: "Hacienda San Gabriel, Puebla", lat: 19.0414, lng: -98.2063 },
  { place: "Casa del Sol, Tepoztlán, Morelos", lat: 18.9853, lng: -99.0993 },
  { place: "Salón Los Arcos, Guadalajara", lat: 20.6597, lng: -103.3496 },
  { place: "Quinta Mirador, Monterrey", lat: 25.6866, lng: -100.3161 },
  { place: "Jardín Botánico, Querétaro", lat: 20.5888, lng: -100.3899 },
  { place: "Playa Nuevo Vallarta, Nayarit", lat: 20.7000, lng: -105.2956 },
  { place: "Palacio de Cristal, Mérida", lat: 20.9674, lng: -89.5926 },
  { place: "Rancho El Encanto, Valle de Bravo", lat: 19.1950, lng: -100.1330 },
];
const themes = ["gold", "neon", "tropical", "minimal", "floral", "kids", "winter", "spring", "autumn", "silver", "copper", "disco", "starlight", "sand", "wildflower", "pastel"];
const titleBuilders = {
  es: [(a, b) => `La boda de ${a} y ${b}`, (a) => `XV años de ${a}`, (a) => `Baby shower de ${a}`, (a) => `Cumpleaños de ${a}`,
    (a) => `Bautizo de ${a}`, (a) => `Graduación de ${a}`, (a, b) => `Aniversario de ${a} y ${b}`, () => "Posada navideña", () => "Reunión familiar"],
  en: [(a, b) => `${a} & ${b}'s wedding`, (a) => `${a}'s birthday party`, (a) => `Baby shower for ${a}`, (a) => `${a}'s graduation`,
    (a, b) => `${a} and ${b}'s anniversary`, () => "Holiday party", () => "Family reunion"],
  pt: [(a, b) => `Casamento de ${a} e ${b}`, (a) => `Aniversário de ${a}`, (a) => `Chá de bebê de ${a}`, (a) => `Formatura de ${a}`, () => "Festa de fim de ano"],
  de: [(a, b) => `Hochzeit von ${a} und ${b}`, (a) => `Geburtstagsfeier von ${a}`, (a) => `Babyparty für ${a}`, (a) => `Abschlussfeier von ${a}`, () => "Weihnachtsfeier"],
  fr: [(a, b) => `Mariage de ${a} et ${b}`, (a) => `Anniversaire de ${a}`, (a) => `Baby shower de ${a}`, (a) => `Remise de diplôme de ${a}`, () => "Fête de fin d'année"],
};
const descriptions = {
  es: "Nos hace mucha ilusión compartir este día contigo. Confirma tu asistencia y cuéntanos si vienes acompañado.",
  en: "We would love to celebrate this day with you. Please confirm your attendance and let us know who is coming along.",
  pt: "Será uma alegria celebrar este dia com você. Confirme sua presença e conte quem vai acompanhar você.",
  de: "Wir freuen uns sehr, diesen Tag mit dir zu feiern. Bitte sag uns zu und gib an, wer dich begleitet.",
  fr: "Nous serions ravis de célébrer ce jour avec toi. Confirme ta présence et dis-nous qui t'accompagne.",
};

const statuses = ["accepted", "accepted", "declined", "pending"];

async function seedOrganizer(i) {
  const locale = organizerLocales[i % organizerLocales.length];
  const { firstName, lastName } = person(i);
  const email = `demo-organizador-${pad(i + 1)}@example.invalid`;
  const c = client(locale);
  await clearMail(email);
  const created = await c.request("/auth/register", { method: "POST", expected: [201, 409], body: { firstName, lastName, email, phone: phoneFor(i), password, accountType: "organizer" } });
  if (created.status === 409) return { email, kind: "organizador", locale, events: "ya existía" };
  await verifyEmail(c, email);
  const count = eventCounts[i];
  const builders = titleBuilders[locale];
  for (let e = 0; e < count; e++) {
    const seed = i * 31 + e * 17;
    const venue = venues[seed % venues.length];
    const host = person(seed + 5), partner = person(seed + 11);
    const date = new Date(Date.now() + (10 + ((seed * 13) % 380)) * 86_400_000);
    date.setUTCHours(1, 0, 0, 0); // 19:00 en Ciudad de México
    const { data: event } = await c.request("/events", {
      method: "POST",
      body: {
        title: `${builders[seed % builders.length](host.firstName, partner.firstName)}`,
        description: descriptions[locale],
        date: date.toISOString(),
        timeZone: "America/Mexico_City",
        location: venue.place,
        geo: { lat: venue.lat, lng: venue.lng },
        theme: themes[seed % themes.length],
      },
    });
    const invitations = 3 + (seed % 3);
    for (let n = 0; n < invitations; n++) {
      const guestSeed = seed * 5 + n;
      const lead = person(guestSeed + 2);
      const family = n % 2 === 0;
      const members = [{ name: `${lead.firstName} ${lead.lastName}`, kind: "adult", notes: "" }];
      if (family) {
        const partnerGuest = person(guestSeed + 9);
        members.push({ name: `${partnerGuest.firstName} ${lead.lastName}`, kind: "adult", notes: "" });
        if (n % 4 === 0) members.push({ name: `${person(guestSeed + 15).firstName} ${lead.lastName}`, kind: "child", notes: "" });
      }
      const { data: invitation } = await c.request(`/events/${event.id}/invitations`, {
        method: "POST",
        body: {
          name: family ? `Familia ${lead.lastName}` : `${lead.firstName} ${lead.lastName}`,
          kind: family ? "family" : "individual",
          email: `invitado-${pad(i + 1)}-${e + 1}-${n + 1}@example.invalid`,
          members,
        },
      });
      // Casi todas las invitaciones ya tienen respuesta de los invitados
      if (guestSeed % 5 !== 4) {
        const guest = client(locale);
        await guest.request(`/invitations/${invitation.token}/rsvp`, {
          method: "POST",
          body: { members: invitation.members.map((m, k) => ({ id: m.id, status: statuses[(guestSeed + k) % statuses.length] })) },
        });
      }
    }
  }
  return { email, kind: "organizador", locale, events: count };
}

// ── Proveedores ─────────────────────────────────────────────────────────────────────────────
const MXN = "MXN";
const providers = [
  { name: "Jardín Las Bugambilias", cat: ["venue"], city: "Cuernavaca", region: "Morelos", lat: 18.9186, lng: -99.2342, headline: "Jardín para bodas y XV años con alberca y salón techado",
    services: [["Renta del jardín", 4500000, "event"], ["Salón techado", 2800000, "event"]] },
  { name: "Eventos Aurora", cat: ["planner", "wedding-planner"], city: "Ciudad de México", region: "CDMX", lat: 19.4326, lng: -99.1332, headline: "Organizamos tu evento de principio a fin",
    services: [["Coordinación del día", 1800000, "event"], ["Planeación completa", 6500000, "event"], ["Asesoría por hora", 85000, "hour"]] },
  { name: "Sillas y Mesas Morelos", cat: ["furniture-rental"], city: "Cuautla", region: "Morelos", lat: 18.8167, lng: -98.9500, headline: "Mobiliario para eventos con entrega y montaje",
    services: [["Silla Tiffany", 3500, "item"], ["Mesa redonda para 10", 18000, "item"]] },
  { name: "Banquetes Doña Chela", cat: ["catering"], city: "Puebla", region: "Puebla", lat: 19.0414, lng: -98.2063, headline: "Cocina tradicional poblana para tus invitados",
    services: [["Menú de tres tiempos", 38000, "person"], ["Buffet mexicano", 29000, "person"], ["Taquiza", 21000, "person"]] },
  { name: "Dulce Tentación Pastelería", cat: ["bakery"], city: "Guadalajara", region: "Jalisco", lat: 20.6597, lng: -103.3496, headline: "Pasteles de boda y mesas de postres",
    services: [["Pastel de tres pisos", 320000, "item"], ["Mesa de postres", 450000, "event"]] },
  { name: "DJ Ritmo Latino", cat: ["dj", "lighting-sound"], city: "Monterrey", region: "Nuevo León", lat: 25.6866, lng: -100.3161, headline: "Música, luces y sonido para que nadie se quede sentado",
    services: [["DJ por 5 horas", 650000, "event"], ["Iluminación robótica", 280000, "event"]] },
  { name: "Mariachi Estrella de Jalisco", cat: ["live-music"], city: "Guadalajara", region: "Jalisco", lat: 20.6766, lng: -103.3475, headline: "Mariachi de 8 elementos para serenatas y fiestas",
    services: [["Serenata de una hora", 350000, "hour"], ["Evento completo", 900000, "event"]] },
  { name: "Luz y Momento Fotografía", cat: ["photo-video"], city: "Querétaro", region: "Querétaro", lat: 20.5888, lng: -100.3899, headline: "Fotos y video que cuentan tu historia",
    services: [["Cobertura de 8 horas", 1500000, "event"], ["Video highlights", 800000, "event"], ["Sesión de pareja", 350000, "event"]] },
  { name: "Flores del Valle Decoración", cat: ["decoration"], city: "Valle de Bravo", region: "Estado de México", lat: 19.1950, lng: -100.1330, headline: "Arreglos florales y ambientación a tu estilo",
    services: [["Centros de mesa", 90000, "item"], ["Arco floral", 480000, "item"]] },
  { name: "Show Lumínico MX", cat: ["entertainment", "lighting-sound"], city: "Ciudad de México", region: "CDMX", lat: 19.3910, lng: -99.1570, headline: "Pantallas LED, cabina de fotos y robot LED",
    services: [["Robot LED", 280000, "hour"], ["Cabina de fotos 360", 420000, "event"]] },
  { name: "Barra Libre Coctelería", cat: ["bar"], city: "Mérida", region: "Yucatán", lat: 20.9674, lng: -89.5926, headline: "Barra móvil con coctelería de autor",
    services: [["Barra de 4 horas", 1200000, "event"], ["Bartender por hora", 60000, "hour"]] },
  { name: "Salón de Belleza Cristal", cat: ["beauty"], city: "Cancún", region: "Quintana Roo", lat: 21.1619, lng: -86.8515, headline: "Maquillaje y peinado para novias y damas",
    services: [["Maquillaje de novia", 280000, "item"], ["Peinado de novia", 220000, "item"]] },
  { name: "Atelier Novias del Sur", cat: ["attire"], city: "Oaxaca", region: "Oaxaca", lat: 17.0732, lng: -96.7266, headline: "Vestidos de novia y trajes a la medida",
    services: [["Vestido de novia a medida", 1800000, "item"], ["Traje de novio", 650000, "item"]] },
  { name: "Limusinas Premier", cat: ["transport"], city: "Toluca", region: "Estado de México", lat: 19.2826, lng: -99.6557, headline: "Autos clásicos, limusinas y autobuses para invitados",
    services: [["Limusina por 3 horas", 480000, "event"], ["Camión para 40 personas", 350000, "day"]] },
  { name: "Quinta Mirador", cat: ["venue", "catering"], city: "Monterrey", region: "Nuevo León", lat: 25.6522, lng: -100.2896, headline: "Quinta con vista a la sierra, menú incluido",
    services: [["Renta con banquete", 7800000, "event"]] },
  { name: "Hacienda San Gabriel", cat: ["venue", "decoration"], city: "Puebla", region: "Puebla", lat: 19.0023, lng: -98.2400, headline: "Hacienda del siglo XIX para bodas inolvidables",
    services: [["Renta de hacienda", 9500000, "event"], ["Ceremonia en capilla", 600000, "event"]] },
  { name: "Mini Fiestas Arcoíris", cat: ["entertainment", "decoration"], city: "Ciudad de México", region: "CDMX", lat: 19.4040, lng: -99.1700, headline: "Fiestas infantiles con payasos, inflables y piñatas",
    services: [["Paquete infantil de 3 horas", 520000, "event"], ["Inflable", 90000, "day"], ["Show de payasos", 240000, "hour"]] },
  { name: "Sabor Costeño Banquetes", cat: ["catering", "bar"], city: "Puerto Vallarta", region: "Jalisco", lat: 20.6534, lng: -105.2253, headline: "Mariscos y cocina de playa para tus eventos",
    services: [["Menú de mariscos", 45000, "person"], ["Barra de cocteles", 38000, "person"]] },
  { name: "Armonía Cuarteto de Cuerdas", cat: ["live-music"], city: "Querétaro", region: "Querétaro", lat: 20.5930, lng: -100.3920, headline: "Música en vivo para ceremonias y recepciones",
    services: [["Ceremonia", 450000, "event"], ["Recepción de dos horas", 620000, "event"]] },
  { name: "Foto Estudio Lumbre", cat: ["photo-video", "planner"], city: "Mérida", region: "Yucatán", lat: 20.9754, lng: -89.6169, headline: "Fotografía documental, dron y fotolibros",
    services: [["Cobertura completa", 1650000, "event"], ["Fotolibro", 280000, "item"], ["Dron", 150000, "hour"]] },
];

/** PNG de degradado vertical entre dos colores: una foto de muestra liviana (la API la reprocesa). */
function gradientPng(width, height, top, bottom) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = [];
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const px = top.map((v, k) => Math.round(v + (bottom[k] - v) * t));
    rows.push(Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => px).flat())]));
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}
const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
};

async function seedProvider(i) {
  const p = providers[i];
  const { firstName, lastName } = person(i + 40);
  const email = `demo-proveedor-${pad(i + 1)}@example.invalid`;
  const c = client("es");
  await clearMail(email);
  const created = await c.request("/auth/register", { method: "POST", expected: [201, 409], body: { firstName, lastName, email, phone: phoneFor(i + 100), password, accountType: "provider" } });
  if (created.status === 409) return { email, kind: "proveedor", locale: "es", events: "-", business: "ya existía" };
  await verifyEmail(c, email);
  await c.request("/provider/profile", {
    method: "PUT",
    body: {
      businessName: p.name,
      headline: p.headline,
      description: `${p.headline}. Atendemos en ${p.city} y alrededores desde hace más de ${5 + (i % 12)} años. Pide tu cotización sin compromiso y cuéntanos la fecha y el número de invitados.`,
      categories: p.cat,
      whatsapp: phoneFor(i + 200),
      publicEmail: `contacto-${pad(i + 1)}@example.invalid`,
      city: p.city,
      region: p.region,
      country: "MX",
      geo: { lat: p.lat, lng: p.lng },
      addressVisibility: i % 3 === 0 ? "exact" : "approximate",
      serviceRadiusKm: 25 + (i % 5) * 25,
    },
  });
  for (const [title, fromCents, unit] of p.services)
    await c.request("/provider/services", {
      method: "POST",
      body: { title, description: `${title} de ${p.name}.`, price: { fromCents, currency: MXN, unit } },
    });
  const hue = (i * 47) % 360;
  const ids = [];
  for (let k = 0; k < 2; k++) {
    const { data } = await c.request("/provider/images", {
      method: "POST",
      body: { dataUrl: gradientPng(960, 640, hsl((hue + k * 25) % 360, 0.55, 0.62), hsl((hue + 40 + k * 25) % 360, 0.5, 0.32)), alt: `${p.name}, foto ${k + 1}` },
    });
    ids.push((data.profile?.images ?? data.images).at(-1).id);
  }
  await c.request("/provider/cover", { method: "PUT", body: { imageId: ids[0] } });
  await c.request("/provider/logo", { method: "PUT", body: { imageId: ids[1] } });
  await c.request("/provider/publish", { method: "POST", body: {} });
  return { email, kind: "proveedor", locale: "es", events: "-", business: p.name };
}

// ── Ejecución ───────────────────────────────────────────────────────────────────────────────
const started = Date.now();
const rows = [];
for (let i = 0; i < eventCounts.length; i++) {
  rows.push(await seedOrganizer(i));
  console.log(`organizador ${pad(i + 1)}/${eventCounts.length} · ${rows.at(-1).events} eventos`);
}
for (let i = 0; i < providers.length; i++) {
  rows.push(await seedProvider(i));
  console.log(`proveedor ${pad(i + 1)}/${providers.length} · ${providers[i].name}`);
}
console.table(rows);
console.log(`Listo en ${Math.round((Date.now() - started) / 1000)} s: ${eventCounts.length} organizadores (${eventCounts.reduce((a, b) => a + b, 0)} eventos) y ${providers.length} proveedores.`);
