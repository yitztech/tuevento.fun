// Visitas por país desde Umami (stats.yunitztech.com), que es quien guarda el país de cada visita.
// Entra con el usuario de solo lectura (POST /api/auth/login), reutiliza el token hasta que Umami
// lo rechaza y pide GET /api/websites/<id>/metrics?type=country (fechas en milisegundos).
// Respuesta de Umami: [{ x: "MX", y: 12 }], con y = visitantes distintos.
const TIMEOUT_MS = 5000;
const CACHE_MS = 5 * 60 * 1000;
const LIMIT = 50;

export function createUmami({ url, username, password, websiteId, fetch = globalThis.fetch, now = () => Date.now() }) {
  const base = url.replace(/\/+$/, "");
  let token = null;
  const cache = new Map();

  async function call(path, init = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw Object.assign(new Error(`Umami respondió ${res.status} en ${path}`), { status: res.status });
    return res.json();
  }

  async function login() {
    const body = await call("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!body?.token) throw new Error("Umami no devolvió token (¿el usuario tiene doble factor?)");
    token = body.token;
  }

  async function authorized(path) {
    if (!token) await login();
    try {
      return await call(path, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      if (error.status !== 401) throw error;
      // El token caducó: se entra otra vez una sola vez
      await login();
      return call(path, { headers: { Authorization: `Bearer ${token}` } });
    }
  }

  // Últimos `days` días, contando hoy (UTC), igual que el resto del panel
  async function countries(days) {
    const hit = cache.get(days);
    if (hit && now() - hit.at < CACHE_MS) return hit.rows;
    const end = now();
    const today = new Date(end);
    const startAt = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * 86_400_000;
    const query = new URLSearchParams({ type: "country", startAt: String(startAt), endAt: String(end), limit: String(LIMIT) });
    const data = await authorized(`/api/websites/${encodeURIComponent(websiteId)}/metrics?${query}`);
    const rows = (Array.isArray(data) ? data : [])
      .map((row) => ({ country: String(row?.x ?? ""), visitors: Number(row?.y) || 0 }))
      .filter((row) => row.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors);
    cache.set(days, { at: now(), rows });
    return rows;
  }

  return { countries };
}

// Lee la configuración del entorno. Sin URL, usuario ni contraseña de la API, el panel funciona sin
// países (desarrollo y CI; UMAMI_WEBSITE_ID puede venir igual, porque producción le da valor por
// defecto). Con solo algunas, o con una URL que no lo es, el arranque se detiene.
export function umamiFromEnv(env = process.env) {
  const names = ["UMAMI_API_URL", "UMAMI_API_USER", "UMAMI_API_PASSWORD", "UMAMI_WEBSITE_ID"];
  const values = names.map((name) => env[name] || "");
  if (values.slice(0, 3).every((value) => !value)) return null;
  const missing = names.filter((_, i) => !values[i]);
  if (missing.length) throw new Error(`Faltan las variables de Umami: ${missing.join(", ")}`);
  const [url, username, password, websiteId] = values;
  if (!/^https?:\/\//.test(url) || !URL.canParse(url)) throw new Error("UMAMI_API_URL no es una URL válida");
  return createUmami({ url, username, password, websiteId });
}
