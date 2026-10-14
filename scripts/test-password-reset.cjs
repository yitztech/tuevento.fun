// Recuperar contraseña en el navegador: se pide desde el dominio inglés, el correo
// llega en inglés a Mailpit con el enlace a ese dominio, y la contraseña nueva entra.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const target = process.env.TEST_WEB_URL || "http://localhost:5187";
const api = process.env.TEST_API_URL || "http://127.0.0.1:3087/api";
const mailpit = process.env.TEST_MAILPIT_URL || "http://127.0.0.1:8025";
const englishHost = new URL(
  process.env.TEST_SITE_URL_EN || "https://en.tueventofun.orb.local",
).hostname;
const local = /^(localhost|127\.0\.0\.1)$/.test(new URL(target).hostname);
const targetEn =
  process.env.TEST_WEB_URL_EN ||
  (local ? `http://${englishHost}:${new URL(target).port || 80}` : `https://${englishHost}`);

async function mailTo(address, subject) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
    ).then((r) => r.json());
    const found = list.messages?.find((m) => subject.test(m.Subject));
    if (found) return fetch(`${mailpit}/api/v1/message/${found.ID}`).then((r) => r.json());
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No llegó a ${address} un correo con asunto ${subject}`);
}

(async () => {
  const unique = crypto.randomBytes(4).toString("hex");
  const email = `ui-reset-${unique}@example.invalid`;
  const registered = await fetch(`${api}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-TuEvento-Client": "1" },
    body: JSON.stringify({
      firstName: "Prueba",
      lastName: "Recuperación",
      email,
      phone: "+527770000000",
      username: `ui_reset_${unique}`,
      password: crypto.randomBytes(16).toString("hex"),
    }),
  }).then((r) => r.json());
  const browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    args: local ? [`--host-resolver-rules=MAP ${englishHost} 127.0.0.1`] : [],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "es-ES",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const errors = [],
    checks = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    // Dominio inglés: todo en inglés aunque el navegador pida español
    await page.goto(targetEn + "/acceso");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page.getByRole("heading", { name: "Get back into your account." })).toBeVisible();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send me the link" }).click();
    await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
    checks.push("Solicitud desde el dominio inglés, en inglés");

    const mail = await mailTo(email, /^Reset your TuEventoFun password$/);
    expect(mail.From.Address).toBe("no-reply@en.tueventofun.orb.local");
    const link = new URL(mail.Text.match(/https?:\/\/\S+\?token=[\w-]{43}/)[0]);
    expect(link.hostname).toBe(englishHost);
    checks.push("Correo en inglés desde el dominio inglés, con enlace a ese dominio");

    await page.goto(targetEn + link.pathname + link.search);
    await expect(page.getByRole("heading", { name: "Choose a new password." })).toBeVisible();
    // El token sale de la barra de direcciones en cuanto se lee
    await expect.poll(() => page.url()).not.toContain("token=");
    await page.getByLabel("New password", { exact: true }).fill("corta");
    await page.getByRole("button", { name: "Save and sign in" }).click();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill(crypto.randomBytes(12).toString("hex"));
    await page.getByRole("button", { name: "Save and sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByText("Done: your password changed and your other sessions were signed out."),
    ).toBeVisible();
    checks.push("Contraseña nueva guardada y sesión iniciada");
    fs.mkdirSync(path.resolve("qa-artifacts"), { recursive: true });
    await page.screenshot({ path: path.resolve("qa-artifacts/password-reset-en-mobile.png") });

    // Dominio español y enlace roto
    const spanish = await context.newPage();
    await spanish.goto(target + "/recuperar-contrasena");
    await expect(spanish.getByRole("heading", { name: "Recupera tu acceso." })).toBeVisible();
    await spanish.goto(target + "/nueva-contrasena?token=roto");
    await expect(
      spanish.getByText("El enlace para cambiar la contraseña no es válido o caducó."),
    ).toBeVisible();
    await expect(spanish.getByRole("link", { name: "Pedir un enlace nuevo" })).toBeVisible();
    checks.push("Páginas en español y enlace no válido");
    const robots = await fetch(target + "/robots.txt").then((r) => r.text());
    expect(robots).toContain("Disallow: /nueva-contrasena");
    checks.push("Las páginas de recuperación no se indexan");
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } catch (e) {
    console.error(e);
    console.log("PAGE", await page.locator("body").innerText().catch(() => ""));
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (!process.env.TEST_WEB_URL && /^[0-9a-f-]{36}$/.test(registered.id || ""))
      require("node:child_process").execFileSync(
        "docker",
        [
          "compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun",
          "-c", `DELETE FROM users WHERE id='${registered.id}' AND email LIKE 'ui-reset-%@example.invalid'`,
        ],
        { stdio: "ignore" },
      );
  }
})();
