// Doble de Nominatim, solo para pruebas (como Mailpit con el correo): responde datos fijos para
// que las suites no llamen al servicio real. Lo usa GEOCODER_URL en compose.yml y compose.ci.yml.
//   /search?q=…   un lugar construido con el texto; "sin resultados" → []; "falla" → 500
//   /reverse      el lugar del punto pedido
import { createServer } from "node:http";

const place = (name, lat, lon) => ({
  lat: String(lat),
  lon: String(lon),
  display_name: `${name}, Cuernavaca, Morelos, México`,
  address: { road: name, city: "Cuernavaca", state: "Morelos", country_code: "mx" },
});

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/healthz") return send(200, { ok: true });
  if (url.pathname === "/search") {
    const q = url.searchParams.get("q") ?? "";
    if (/falla/i.test(q)) return send(500, { error: "fallo de prueba" });
    if (/sin resultados/i.test(q)) return send(200, []);
    return send(200, [place(q, 18.9218, -99.2347), place(`${q} 2`, 18.93, -99.24)]);
  }
  if (url.pathname === "/reverse") {
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    return send(200, place("Calle de prueba 1", lat, lon));
  }
  send(404, { error: "not found" });
}).listen(8080);
