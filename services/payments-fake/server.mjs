// Doble de Stripe Checkout, solo para pruebas (como Mailpit con el correo): la API le pide la
// sesión igual que a Stripe (STRIPE_API_URL) y el navegador paga en una página de mentira, que manda
// el webhook firmado como lo hace Stripe. Nunca mueve dinero.
//   POST /v1/checkout/sessions   crea la sesión (Bearer = SECRET_KEY; Idempotency-Key repetida = la misma)
//   GET  /pay/:id                página con «Pagar» y «Cancelar»
//   POST /pay/:id                action=pay: webhook checkout.session.completed y vuelta a success_url;
//                                action=cancel: vuelta a cancel_url; action=expire: la sesión caduca;
//                                action=fail: un pago diferido rechazado; action=hold: pagado, sin webhook aún
//   GET  /v1/checkout/sessions/:id         la sesión, con lo que recibió
//   POST /v1/checkout/sessions/:id/expire  caduca una sesión abierta (si no, 400, como Stripe)
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const { SECRET_KEY = "", WEBHOOK_SECRET = "", WEBHOOK_URL = "", PUBLIC_URL = "http://127.0.0.1:8099" } = process.env;
const sessions = new Map();
// Idiomas que acepta la API de Checkout (los que usa la app y sus variantes)
const STRIPE_LOCALES = new Set(["auto", "de", "en", "en-GB", "es", "es-419", "fr", "fr-CA", "pt", "pt-BR"]);
const byIdempotencyKey = new Map();

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(new URLSearchParams(data)));
  });
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function sendWebhook(session, type = "checkout.session.completed", paymentStatus = "paid") {
  const body = JSON.stringify({
    id: `evt_${randomBytes(12).toString("hex")}`,
    type,
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        client_reference_id: session.params.get("client_reference_id"),
        payment_status: paymentStatus,
        amount_total: Number(session.params.get("line_items[0][price_data][unit_amount]")),
        currency: session.params.get("line_items[0][price_data][currency]"),
        metadata: { payment_id: session.params.get("metadata[payment_id]") },
      },
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${v1}` },
    body,
  });
  if (!response.ok) console.error(`webhook ${response.status}: ${await response.text()}`);
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/healthz") return json(200, { ok: true });
  if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
    if (req.headers.authorization !== `Bearer ${SECRET_KEY}`) return json(401, { error: { message: "Invalid API key" } });
    const params = await readBody(req);
    const key = req.headers["idempotency-key"];
    const existing = key && byIdempotencyKey.get(key);
    if (existing) return json(200, existing.view);
    // Stripe rechaza estos valores: el doble también, para que las pruebas lo noten
    const left = Number(params.get("expires_at")) - Date.now() / 1000;
    if (!STRIPE_LOCALES.has(params.get("locale"))) return json(400, { error: { message: "Invalid locale" } });
    if (!(left >= 30 * 60 && left <= 24 * 3600)) return json(400, { error: { message: "Invalid expires_at" } });
    const id = `cs_test_${randomBytes(16).toString("hex")}`;
    const session = {
      id,
      params,
      status: "open",
      version: req.headers["stripe-version"],
      view: { id, object: "checkout.session", url: `${PUBLIC_URL}/pay/${id}` },
    };
    sessions.set(id, session);
    if (key) byIdempotencyKey.set(key, session);
    return json(200, session.view);
  }
  const api = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_test_[0-9a-f]+)(\/expire)?$/);
  if (api) {
    if (req.headers.authorization !== `Bearer ${SECRET_KEY}`) return json(401, { error: { message: "Invalid API key" } });
    const found = sessions.get(api[1]);
    if (!found) return json(404, { error: { message: "No such session" } });
    const view = () => ({ ...found.view, status: found.status, locale: found.params.get("locale"), expires_at: Number(found.params.get("expires_at")), stripe_version: found.version });
    if (req.method === "GET" && !api[2]) return json(200, view());
    if (req.method === "POST" && api[2]) {
      if (found.status !== "open") return json(400, { error: { message: "Only Checkout Sessions with a status in [\"open\"] can be expired" } });
      found.status = "expired";
      await sendWebhook(found, "checkout.session.expired", "unpaid");
      return json(200, view());
    }
  }
  const pay = url.pathname.match(/^\/pay\/(cs_test_[0-9a-f]+)$/);
  const session = pay && sessions.get(pay[1]);
  if (pay && !session) return json(404, { error: "no existe" });
  if (session && req.method === "GET") {
    const cents = Number(session.params.get("line_items[0][price_data][unit_amount]"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Pago de prueba</title>
<main><h1>Pago de prueba</h1><p>${escape(session.params.get("line_items[0][price_data][product_data][name]"))}</p>
<p>${escape(session.params.get("line_items[0][price_data][product_data][description]"))}</p>
<p><strong>$${(cents / 100).toFixed(2)} USD</strong></p>
<form method="post"><button name="action" value="pay">Pagar</button> <button name="action" value="cancel">Cancelar</button></form></main></html>`);
  }
  if (session && req.method === "POST") {
    const action = (await readBody(req)).get("action");
    if (action === "expire" || action === "fail") {
      session.status = action === "fail" ? "complete" : "expired";
      await sendWebhook(session, `checkout.session.${action === "fail" ? "async_payment_failed" : "expired"}`, "unpaid");
    }
    if (action === "hold") session.status = "complete";
    if (action === "pay") {
      session.status = "complete";
      await sendWebhook(session);
    }
    const back = session.params.get(action === "pay" ? "success_url" : "cancel_url");
    res.writeHead(303, { Location: back.replace("{CHECKOUT_SESSION_ID}", session.id) });
    return res.end();
  }
  json(404, { error: "not found" });
}).listen(8080);
